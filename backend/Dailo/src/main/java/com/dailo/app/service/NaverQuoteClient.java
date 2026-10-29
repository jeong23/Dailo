package com.dailo.app.service;

import com.dailo.app.dto.QuoteDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * 네이버 금융 폴링 시세 — KIS 키가 없을 때 쓰는 임시 시세 소스 (키·계좌 불필요, 체결 즉시가 아니라 폴링 간격만큼 지연).
 * GET https://polling.finance.naver.com/api/realtime/domestic/stock/{code,code,...}
 * 공식 API가 아니라 응답 형식이 바뀌면 조용히 빈 결과가 됨 → 화면은 수동 현재가로 돌아감.
 * quote.naver.enabled=false 로 끌 수 있음.
 */
@Slf4j
@Component
public class NaverQuoteClient {

    private static final String BASE = "https://polling.finance.naver.com/api/realtime/domestic/stock/";
    private static final int BATCH = 20; // 한 요청에 여러 종목 — URL 길이 여유

    private final ObjectMapper objectMapper;
    private final boolean enabled;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public NaverQuoteClient(ObjectMapper objectMapper, @Value("${quote.naver.enabled:true}") boolean enabled) {
        this.objectMapper = objectMapper;
        this.enabled = enabled;
    }

    public boolean isEnabled() {
        return enabled;
    }

    /** 종목 여러 개 현재가 (장 마감 후엔 종가). 실패한 묶음은 건너뜀 — 예외 대신 받은 것만 반환 */
    public List<QuoteDto.Quote> fetch(Collection<String> codes) throws IOException {
        List<String> all = new ArrayList<>(codes);
        List<QuoteDto.Quote> out = new ArrayList<>();
        IOException lastError = null;
        for (int i = 0; i < all.size(); i += BATCH) {
            String joined = String.join(",", all.subList(i, Math.min(i + BATCH, all.size())));
            try {
                HttpRequest req = HttpRequest.newBuilder(URI.create(BASE + joined))
                        .timeout(Duration.ofSeconds(8))
                        .header("User-Agent", "Mozilla/5.0 (Dailo personal dashboard)")
                        .GET().build();
                HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() != 200) throw new IOException("네이버 시세 HTTP " + res.statusCode());
                out.addAll(parse(objectMapper, res.body()));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (IOException e) {
                lastError = e;
            }
        }
        if (out.isEmpty() && lastError != null) throw lastError;
        return out;
    }

    /** 응답 JSON → Quote 목록. 가격 0·누락 종목은 제외. 부호는 compareToPreviousPrice.code(1·2 상승 / 4·5 하락)로 */
    static List<QuoteDto.Quote> parse(ObjectMapper mapper, String body) throws IOException {
        List<QuoteDto.Quote> out = new ArrayList<>();
        for (JsonNode d : mapper.readTree(body).path("datas")) {
            String code = d.path("itemCode").asText("");
            long price = number(d.path("closePriceRaw").asText("")).longValue();
            if (code.isEmpty() || price <= 0) continue;
            int sign = KisMessageParser.signOf(d.path("compareToPreviousPrice").path("code").asText(""));
            long change = number(d.path("compareToPreviousClosePriceRaw").asText("")).abs().longValue() * sign;
            double rate = number(d.path("fluctuationsRatioRaw").asText("")).abs().doubleValue() * sign;
            out.add(new QuoteDto.Quote(code, price, change, rate, timeOf(d.path("localTradedAt").asText("")), "NAVER"));
        }
        return out;
    }

    private static BigDecimal number(String raw) {
        try {
            return new BigDecimal(raw.replace(",", "").trim());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    // "2026-10-28T15:30:00+09:00" → "153000"
    private static String timeOf(String iso) {
        int t = iso.indexOf('T');
        if (t < 0 || iso.length() < t + 9) return null;
        return iso.substring(t + 1, t + 9).replace(":", "");
    }
}
