package com.dailo.app.service;

import com.dailo.app.dto.QuoteDto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 한국투자증권 실시간 웹소켓 체결가(H0STCNT0) 메시지 파서.
 * 데이터 메시지 형식: "0|H0STCNT0|003|005930^093354^71900^5^-100^-0.14^...(레코드당 고정 필드 수)..."
 *   - 첫 칸 0/1: 암호화 여부 (체결가는 0), 셋째 칸: 레코드 수 — 한 메시지에 여러 체결이 '^'로 이어 붙어 옴
 *   - 레코드 필드 순서: 종목코드, 체결시각, 현재가, 전일대비부호, 전일대비, 전일대비율 ...
 * JSON 메시지(구독 응답, PINGPONG)는 '{'로 시작하므로 여기서 다루지 않는다.
 */
public final class KisMessageParser {

    public static final String TR_STOCK_TRADE = "H0STCNT0";

    private KisMessageParser() {
    }

    public static boolean isJson(String message) {
        return message != null && message.startsWith("{");
    }

    /** 체결가 데이터 메시지를 시세 목록으로 변환. 형식이 다르거나 다른 TR이면 빈 목록 */
    public static List<QuoteDto.Quote> parseTrade(String message) {
        if (message == null || isJson(message)) return Collections.emptyList();
        String[] parts = message.split("\\|", 4);
        if (parts.length < 4 || !"0".equals(parts[0]) || !TR_STOCK_TRADE.equals(parts[1])) {
            return Collections.emptyList();
        }
        int count;
        try {
            count = Integer.parseInt(parts[2]);
        } catch (NumberFormatException e) {
            return Collections.emptyList();
        }
        String[] tokens = parts[3].split("\\^", -1);
        if (count <= 0 || tokens.length < count * 6) return Collections.emptyList();

        int fieldsPerRecord = tokens.length / count;
        List<QuoteDto.Quote> quotes = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            int base = i * fieldsPerRecord;
            try {
                String code = tokens[base];
                String time = tokens[base + 1];
                long price = new BigDecimal(tokens[base + 2]).longValue();
                int sign = signOf(tokens[base + 3]);
                long change = new BigDecimal(tokens[base + 4]).abs().longValue() * sign;
                double changeRate = new BigDecimal(tokens[base + 5]).abs().doubleValue() * sign;
                quotes.add(new QuoteDto.Quote(code, price, change, changeRate, time, "REALTIME"));
            } catch (RuntimeException e) {
                // 깨진 레코드 하나 때문에 나머지를 버리지 않음
            }
        }
        return quotes;
    }

    /** 전일대비부호: 1 상한, 2 상승, 3 보합, 4 하한, 5 하락 */
    static int signOf(String sign) {
        return switch (sign) {
            case "1", "2" -> 1;
            case "4", "5" -> -1;
            default -> 0;
        };
    }
}
