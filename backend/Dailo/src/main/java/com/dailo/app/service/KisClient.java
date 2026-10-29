package com.dailo.app.service;

import com.dailo.app.dto.QuoteDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;

/**
 * 한국투자증권(KIS) Open API 클라이언트 — 시세 "조회" 전용 (주문 API는 사용하지 않음).
 *  - REST: 웹소켓 접속키(approval_key), 접근토큰, 현재가 1회 조회(장 마감 후 화면 초기값용)
 *  - WebSocket: 실시간 체결가(H0STCNT0) 구독, PINGPONG 응답, 끊기면 지수 백오프로 재접속
 * 키 설정: 환경변수 KIS_APP_KEY / KIS_APP_SECRET (또는 kis.app-key / kis.app-secret), 모의투자 키면 KIS_MOCK=true
 * 키가 없으면 isConfigured()=false 로 아무 연결도 하지 않는다 (앱 기동에는 영향 없음).
 * 웹소켓 상태(ws, subscribed)는 전부 단일 스레드 scheduler 에서만 바꾼다.
 */
@Slf4j
@Component
public class KisClient {

    private static final int MAX_SUBSCRIPTIONS = 40; // KIS 세션당 실시간 등록 한도(약 41건) 이하로 제한

    private final ObjectMapper objectMapper;
    private final String appKey;
    private final String appSecret;
    private final boolean mock;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "kis-ws");
        t.setDaemon(true);
        return t;
    });

    // REST 접근토큰 — 24시간 유효, 발급은 분당 1회 제한이라 메모리에 캐시해서 재사용
    private String accessToken;
    private Instant tokenExpiresAt = Instant.EPOCH;
    private Instant lastTokenRequestAt = Instant.EPOCH;

    // 웹소켓 상태 (scheduler 스레드 전용)
    private WebSocket ws;
    private String approvalKey;
    private final Set<String> subscribed = new HashSet<>();
    private Set<String> desired = Set.of();
    private int backoffSeconds = 5;
    private boolean reconnectScheduled;
    private boolean shuttingDown;

    private volatile Consumer<QuoteDto.Quote> onQuote = q -> { };
    private volatile Consumer<Boolean> onConnectionChange = c -> { };

    public KisClient(ObjectMapper objectMapper,
                     @Value("${kis.app-key:}") String appKey,
                     @Value("${kis.app-secret:}") String appSecret,
                     @Value("${kis.mock:false}") boolean mock) {
        this.objectMapper = objectMapper;
        this.appKey = appKey.trim();
        this.appSecret = appSecret.trim();
        this.mock = mock;
    }

    public boolean isConfigured() {
        return !appKey.isEmpty() && !appSecret.isEmpty();
    }

    public void setListeners(Consumer<QuoteDto.Quote> onQuote, Consumer<Boolean> onConnectionChange) {
        this.onQuote = onQuote;
        this.onConnectionChange = onConnectionChange;
    }

    private String restBase() {
        return mock ? "https://openapivts.koreainvestment.com:29443" : "https://openapi.koreainvestment.com:9443";
    }

    private String wsUrl() {
        return mock ? "ws://ops.koreainvestment.com:31000" : "ws://ops.koreainvestment.com:21000";
    }

    // ─── REST ──────────────────────────────────────────────────

    private JsonNode postJson(String path, Map<String, String> body) throws IOException, InterruptedException {
        HttpRequest req = HttpRequest.newBuilder(URI.create(restBase() + path))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json; charset=UTF-8")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                .build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) {
            throw new IOException("KIS " + path + " 실패: HTTP " + res.statusCode() + " " + res.body());
        }
        return objectMapper.readTree(res.body());
    }

    private String issueApprovalKey() throws IOException, InterruptedException {
        JsonNode node = postJson("/oauth2/Approval",
                Map.of("grant_type", "client_credentials", "appkey", appKey, "secretkey", appSecret));
        String key = node.path("approval_key").asText("");
        if (key.isEmpty()) throw new IOException("KIS approval_key 응답 없음: " + node);
        return key;
    }

    private synchronized String accessToken() throws IOException, InterruptedException {
        Instant now = Instant.now();
        if (accessToken != null && now.isBefore(tokenExpiresAt.minusSeconds(600))) return accessToken;
        if (Duration.between(lastTokenRequestAt, now).toSeconds() < 65) {
            throw new IOException("KIS 접근토큰 발급 대기 중 (분당 1회 제한)");
        }
        lastTokenRequestAt = now;
        JsonNode node = postJson("/oauth2/tokenP",
                Map.of("grant_type", "client_credentials", "appkey", appKey, "appsecret", appSecret));
        String token = node.path("access_token").asText("");
        if (token.isEmpty()) throw new IOException("KIS access_token 응답 없음: " + node);
        accessToken = token;
        tokenExpiresAt = now.plusSeconds(node.path("expires_in").asLong(86_400));
        return token;
    }

    /** 국내 주식/ETF 현재가 1회 조회 (장 마감 후에도 종가 반환). 실패 시 empty */
    public Optional<QuoteDto.Quote> fetchPrice(String code) {
        if (!isConfigured()) return Optional.empty();
        try {
            HttpRequest req = HttpRequest.newBuilder(URI.create(restBase()
                            + "/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=" + code))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json; charset=UTF-8")
                    .header("authorization", "Bearer " + accessToken())
                    .header("appkey", appKey)
                    .header("appsecret", appSecret)
                    .header("tr_id", "FHKST01010100")
                    .header("custtype", "P")
                    .GET().build();
            HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode node = objectMapper.readTree(res.body());
            if (res.statusCode() != 200 || !"0".equals(node.path("rt_cd").asText())) {
                log.warn("KIS 현재가 조회 실패 code={} status={} msg={}", code, res.statusCode(), node.path("msg1").asText());
                return Optional.empty();
            }
            JsonNode out = node.path("output");
            int sign = KisMessageParser.signOf(out.path("prdy_vrss_sign").asText(""));
            long price = new BigDecimal(out.path("stck_prpr").asText("0")).longValue();
            long change = new BigDecimal(out.path("prdy_vrss").asText("0")).abs().longValue() * sign;
            double rate = new BigDecimal(out.path("prdy_ctrt").asText("0")).abs().doubleValue() * sign;
            if (price <= 0) return Optional.empty();
            return Optional.of(new QuoteDto.Quote(code, price, change, rate, null, "SNAPSHOT"));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (Exception e) {
            log.warn("KIS 현재가 조회 오류 code={}: {}", code, e.getMessage());
            return Optional.empty();
        }
    }

    // ─── WebSocket ─────────────────────────────────────────────

    /** 구독할 종목 전체 목록을 넘기면 접속/추가 구독/해제를 맞춰준다 (비어 있으면 연결 종료) */
    public void updateSubscriptions(Set<String> codes) {
        if (!isConfigured()) return;
        Set<String> capped = new TreeSet<>(codes);
        if (capped.size() > MAX_SUBSCRIPTIONS) {
            log.warn("실시간 구독 종목 {}개 중 {}개만 구독 (KIS 세션당 한도)", capped.size(), MAX_SUBSCRIPTIONS);
            capped = new TreeSet<>(new ArrayList<>(capped).subList(0, MAX_SUBSCRIPTIONS));
        }
        Set<String> target = Set.copyOf(capped);
        scheduler.execute(() -> {
            desired = target;
            reconcile();
        });
    }

    private void reconcile() {
        if (shuttingDown) return;
        if (desired.isEmpty()) {
            closeSocket();
            return;
        }
        if (ws == null) {
            connect();
            return;
        }
        for (String code : desired) {
            if (!subscribed.contains(code) && sendSubscription(code, true)) subscribed.add(code);
        }
        for (String code : new ArrayList<>(subscribed)) {
            if (!desired.contains(code) && sendSubscription(code, false)) subscribed.remove(code);
        }
    }

    private void connect() {
        try {
            if (approvalKey == null) approvalKey = issueApprovalKey();
            ws = http.newWebSocketBuilder()
                    .connectTimeout(Duration.ofSeconds(10))
                    .buildAsync(URI.create(wsUrl()), new Listener())
                    .get(15, TimeUnit.SECONDS);
            subscribed.clear();
            backoffSeconds = 5;
            log.info("KIS 실시간 웹소켓 연결됨 ({})", mock ? "모의" : "실전");
            onConnectionChange.accept(true);
            reconcile();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            log.warn("KIS 웹소켓 연결 실패: {}", e.getMessage());
            ws = null;
            approvalKey = null; // 접속키가 만료/무효일 수 있으니 다음 시도에서 재발급
            scheduleReconnect();
        }
    }

    private boolean sendSubscription(String code, boolean subscribe) {
        Map<String, Object> msg = Map.of(
                "header", Map.of("approval_key", approvalKey, "custtype", "P",
                        "tr_type", subscribe ? "1" : "2", "content-type", "utf-8"),
                "body", Map.of("input", Map.of("tr_id", KisMessageParser.TR_STOCK_TRADE, "tr_key", code)));
        try {
            ws.sendText(objectMapper.writeValueAsString(msg), true).get(10, TimeUnit.SECONDS);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } catch (Exception e) {
            log.warn("KIS 구독 {} 실패 code={}: {}", subscribe ? "등록" : "해제", code, e.getMessage());
            return false;
        }
    }

    private void handleMessage(String message) {
        if (KisMessageParser.isJson(message)) {
            try {
                JsonNode node = objectMapper.readTree(message);
                String trId = node.path("header").path("tr_id").asText();
                if ("PINGPONG".equals(trId)) {
                    // 서버 생존 확인 — 받은 그대로 돌려줘야 연결이 유지됨
                    scheduler.execute(() -> {
                        if (ws != null) ws.sendText(message, true);
                    });
                    return;
                }
                JsonNode body = node.path("body");
                if (!body.isMissingNode() && !"0".equals(body.path("rt_cd").asText("0"))) {
                    log.warn("KIS 구독 응답 오류 tr_key={} msg={}", node.path("header").path("tr_key").asText(), body.path("msg1").asText());
                }
            } catch (IOException e) {
                log.debug("KIS JSON 메시지 파싱 실패: {}", message);
            }
            return;
        }
        for (QuoteDto.Quote quote : KisMessageParser.parseTrade(message)) {
            onQuote.accept(quote);
        }
    }

    private void onSocketClosed(WebSocket closed, String reason) {
        scheduler.execute(() -> {
            if (ws == null || ws != closed) return; // 의도적 종료이거나 이미 교체된 옛 소켓의 늦은 이벤트
            log.warn("KIS 웹소켓 끊김: {}", reason);
            ws = null;
            subscribed.clear();
            onConnectionChange.accept(false);
            scheduleReconnect();
        });
    }

    private void scheduleReconnect() {
        if (shuttingDown || reconnectScheduled || desired.isEmpty()) return;
        reconnectScheduled = true;
        int delay = backoffSeconds;
        backoffSeconds = Math.min(backoffSeconds * 2, 60);
        scheduler.schedule(() -> {
            reconnectScheduled = false;
            reconcile();
        }, delay, TimeUnit.SECONDS);
    }

    private void closeSocket() {
        if (ws == null) return;
        WebSocket old = ws;
        ws = null;
        subscribed.clear();
        old.sendClose(WebSocket.NORMAL_CLOSURE, "bye");
        onConnectionChange.accept(false);
    }

    @PreDestroy
    void shutdown() {
        try {
            scheduler.submit(() -> {
                shuttingDown = true;
                closeSocket();
            }).get(3, TimeUnit.SECONDS);
        } catch (Exception ignored) {
            // 종료 중이므로 무시
        }
        scheduler.shutdownNow();
    }

    private class Listener implements WebSocket.Listener {
        private final StringBuilder buffer = new StringBuilder();

        @Override
        public void onOpen(WebSocket webSocket) {
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            buffer.append(data);
            if (last) {
                String message = buffer.toString();
                buffer.setLength(0);
                try {
                    handleMessage(message);
                } catch (RuntimeException e) {
                    log.warn("KIS 메시지 처리 오류: {}", e.getMessage());
                }
            }
            webSocket.request(1);
            return null;
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            onSocketClosed(webSocket, "close " + statusCode + " " + reason);
            return null;
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            onSocketClosed(webSocket, "error " + error.getMessage());
        }
    }
}
