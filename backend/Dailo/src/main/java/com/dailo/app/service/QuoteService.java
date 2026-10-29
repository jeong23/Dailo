package com.dailo.app.service;

import com.dailo.app.dto.QuoteDto;
import com.dailo.app.repository.InvestHoldingRepository;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;
import java.util.concurrent.*;

/**
 * 실시간 시세 허브.
 *  KIS 웹소켓(KisClient) → 최신 시세 캐시(quotes) → 브라우저 SSE 구독자에게 본인 종목 시세만 전달
 * 키가 없으면 네이버 금융 폴링(NaverQuoteClient)으로 대신 채운다 — 장중 20초, 장외 10분 간격. 둘 다 없으면 수동 현재가.
 * SSE 이벤트: snapshot(접속 직후 전체), quote(종목 1개 변경), status(연결 상태 변경), 25초마다 주석 하트비트
 */
@Slf4j
@Service
public class QuoteService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final long EMITTER_TIMEOUT_MS = 30 * 60 * 1000L; // 30분 후 끊기면 브라우저가 재접속
    private static final long NAVER_POLL_SECONDS = 20;               // 장중 폴링 간격
    private static final long NAVER_IDLE_MS = 10 * 60 * 1000L;       // 장외엔 종가만 가끔 확인

    private final KisClient kis;
    private final NaverQuoteClient naver;
    private final InvestHoldingRepository holdingRepo;

    private final Map<String, QuoteDto.Quote> quotes = new ConcurrentHashMap<>();
    private final List<Subscriber> subscribers = new CopyOnWriteArrayList<>();
    private volatile boolean connected;

    private final ScheduledExecutorService heartbeat = daemonScheduler("quote-heartbeat");
    private final ExecutorService snapshotLoader = Executors.newSingleThreadExecutor(r -> daemon(r, "quote-snapshot"));
    // 네이버 폴링은 이 스레드 하나에서만 — naverCodes/lastNaverPoll 동시 접근 없음
    private final ScheduledExecutorService naverPoller = daemonScheduler("quote-naver");
    private volatile Set<String> naverCodes = Set.of();
    private volatile long lastNaverPoll;

    public QuoteService(KisClient kis, NaverQuoteClient naver, InvestHoldingRepository holdingRepo) {
        this.kis = kis;
        this.naver = naver;
        this.holdingRepo = holdingRepo;
    }

    private boolean naverMode() {
        return !kis.isConfigured() && naver.isEnabled();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        kis.setListeners(this::onQuote, this::onConnectionChange);
        heartbeat.scheduleAtFixedRate(this::sendHeartbeats, 25, 25, TimeUnit.SECONDS);
        if (naverMode()) {
            log.info("KIS 키 미설정 — 네이버 금융 시세로 대체 (장중 {}초 간격). KIS_APP_KEY / KIS_APP_SECRET 설정 시 실시간 전환", NAVER_POLL_SECONDS);
            naverPoller.scheduleWithFixedDelay(() -> pollNaver(false), 0, NAVER_POLL_SECONDS, TimeUnit.SECONDS);
            return;
        }
        if (!kis.isConfigured()) {
            log.info("KIS 키 미설정, 네이버 시세 꺼짐 — 수동 현재가 사용");
            return;
        }
        refreshSubscriptions();
    }

    @TransactionalEventListener
    public void onHoldingsChanged(InvestHoldingsChangedEvent event) {
        refreshSubscriptions();
        if (naverMode()) naverPoller.execute(() -> pollNaver(true)); // 새 종목코드 바로 조회
        for (Subscriber s : subscribers) {
            s.codes = codesOf(s.memberId);
            s.send("snapshot", snapshot(s.memberId));
        }
    }

    private void refreshSubscriptions() {
        if (!kis.isConfigured()) return;
        Set<String> codes = new HashSet<>(holdingRepo.findAllStockCodes());
        kis.updateSubscriptions(codes);
        // 장 마감 후·첫 체결 전에도 가격이 보이도록 아직 모르는 종목은 REST로 한 번 채움
        List<String> missing = codes.stream().filter(c -> !quotes.containsKey(c)).sorted().toList();
        if (!missing.isEmpty()) {
            snapshotLoader.execute(() -> {
                for (String code : missing) {
                    kis.fetchPrice(code).ifPresent(this::onQuote);
                    try {
                        Thread.sleep(150); // REST 초당 호출 제한 여유
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                }
            });
        }
    }

    /** 네이버 폴링 1회 — force면 장외 간격 무시 (종목 변경 직후) */
    private void pollNaver(boolean force) {
        try {
            long now = System.currentTimeMillis();
            if (force || lastNaverPoll == 0) naverCodes = new HashSet<>(holdingRepo.findAllStockCodes());
            if (naverCodes.isEmpty()) return;
            boolean open = isMarketOpen(ZonedDateTime.now(KST));
            if (!force && !open && now - lastNaverPoll < NAVER_IDLE_MS) return;
            lastNaverPoll = now;
            List<QuoteDto.Quote> fetched = naver.fetch(naverCodes);
            fetched.forEach(this::onQuote);
            if (!connected && !fetched.isEmpty()) onConnectionChange(true);
        } catch (IOException e) {
            if (connected) log.warn("네이버 시세 조회 실패: {}", e.getMessage());
            if (connected) onConnectionChange(false);
        } catch (RuntimeException e) {
            // 예외가 새면 scheduleWithFixedDelay가 이후 실행을 멈춤
            log.warn("네이버 시세 폴링 오류: {}", e.getMessage());
        }
    }

    private void onQuote(QuoteDto.Quote quote) {
        // 늦게 도착한 REST 스냅샷이 더 최신인 실시간 체결가를 덮어쓰지 않도록
        QuoteDto.Quote merged = quotes.merge(quote.code(), quote, (old, incoming) ->
                "SNAPSHOT".equals(incoming.source()) && "REALTIME".equals(old.source()) ? old : incoming);
        if (merged != quote) return;
        for (Subscriber s : subscribers) {
            if (s.codes.contains(quote.code())) s.send("quote", quote);
        }
    }

    private void onConnectionChange(boolean isConnected) {
        connected = isConnected;
        QuoteDto.Status status = status();
        for (Subscriber s : subscribers) s.send("status", status);
    }

    public QuoteDto.Status status() {
        String provider = kis.isConfigured() ? "KIS" : naverMode() ? "NAVER" : "NONE";
        return new QuoteDto.Status(kis.isConfigured(), connected, isMarketOpen(ZonedDateTime.now(KST)), provider);
    }

    /** 정규장(평일 09:00~15:30) 여부 — 공휴일은 반영하지 않음, 화면 표시용 힌트 */
    static boolean isMarketOpen(ZonedDateTime now) {
        DayOfWeek day = now.getDayOfWeek();
        if (day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY) return false;
        LocalTime t = now.toLocalTime();
        return !t.isBefore(LocalTime.of(9, 0)) && t.isBefore(LocalTime.of(15, 30));
    }

    private Set<String> codesOf(Long memberId) {
        return new HashSet<>(holdingRepo.findStockCodesByMemberId(memberId));
    }

    public QuoteDto.Snapshot snapshot(Long memberId) {
        Map<String, QuoteDto.Quote> mine = new HashMap<>();
        for (String code : codesOf(memberId)) {
            QuoteDto.Quote q = quotes.get(code);
            if (q != null) mine.put(code, q);
        }
        return new QuoteDto.Snapshot(status(), mine);
    }

    public SseEmitter subscribe(Long memberId) {
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
        Subscriber subscriber = new Subscriber(memberId, emitter, codesOf(memberId));
        subscribers.add(subscriber);
        emitter.onCompletion(() -> subscribers.remove(subscriber));
        emitter.onTimeout(() -> subscribers.remove(subscriber));
        emitter.onError(e -> subscribers.remove(subscriber));
        subscriber.send("snapshot", snapshot(memberId));
        return emitter;
    }

    private void sendHeartbeats() {
        QuoteDto.Status status = status();
        for (Subscriber s : subscribers) {
            s.heartbeat();
            // 장 시작/마감 시각을 넘기면 화면 표시가 바뀌도록 상태도 같이 갱신
            if (s.lastMarketOpen != status.marketOpen()) s.send("status", status);
        }
    }

    @PreDestroy
    void shutdown() {
        heartbeat.shutdownNow();
        snapshotLoader.shutdownNow();
        naverPoller.shutdownNow();
        subscribers.forEach(s -> s.emitter.complete());
    }

    private static Thread daemon(Runnable r, String name) {
        Thread t = new Thread(r, name);
        t.setDaemon(true);
        return t;
    }

    private static ScheduledExecutorService daemonScheduler(String name) {
        return Executors.newSingleThreadScheduledExecutor(r -> daemon(r, name));
    }

    private final class Subscriber {
        final Long memberId;
        final SseEmitter emitter;
        volatile Set<String> codes;
        volatile boolean lastMarketOpen;

        Subscriber(Long memberId, SseEmitter emitter, Set<String> codes) {
            this.memberId = memberId;
            this.emitter = emitter;
            this.codes = codes;
        }

        // SseEmitter.send는 동시 호출에 안전하지 않아 구독자 단위로 직렬화
        synchronized void send(String event, Object data) {
            if (data instanceof QuoteDto.Snapshot snap) lastMarketOpen = snap.status().marketOpen();
            if (data instanceof QuoteDto.Status st) lastMarketOpen = st.marketOpen();
            try {
                emitter.send(SseEmitter.event().name(event).data(data, MediaType.APPLICATION_JSON));
            } catch (IOException e) {
                // 브라우저가 이미 끊음 (탭 닫기·새로고침·페이지 이동) — 컨테이너가 정리하므로 complete() 하지 않음
                //  끊긴 연결에 complete()를 부르면 AsyncRequestNotUsableException이 '서버 오류' ERROR 로그로 찍혔음
                subscribers.remove(this);
            } catch (IllegalStateException e) {
                drop();
            }
        }

        synchronized void heartbeat() {
            try {
                emitter.send(SseEmitter.event().comment("ping"));
            } catch (IOException e) {
                subscribers.remove(this); // 끊긴 연결 — complete() 하지 않음 (send 참고)
            } catch (IllegalStateException e) {
                drop();
            }
        }

        private void drop() {
            subscribers.remove(this);
            try {
                emitter.complete();
            } catch (RuntimeException ignored) {
                // 이미 닫힌 연결
            }
        }
    }
}
