package com.dailo.app.service;

import com.dailo.app.dto.QuoteDto;
import org.junit.jupiter.api.Test;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RealtimeQuoteTest {

    // H0STCNT0 레코드: 종목코드^체결시각^현재가^부호^전일대비^전일대비율^... (뒤 필드는 개수만 맞춤)
    private static String record(String code, String time, String price, String sign, String change, String rate) {
        List<String> fields = new java.util.ArrayList<>(List.of(code, time, price, sign, change, rate));
        fields.addAll(Collections.nCopies(40, "0"));
        return String.join("^", fields);
    }

    @Test
    void 체결가_메시지_한건_파싱() {
        String msg = "0|H0STCNT0|001|" + record("005930", "093354", "71900", "5", "-100", "-0.14");

        List<QuoteDto.Quote> quotes = KisMessageParser.parseTrade(msg);

        assertThat(quotes).hasSize(1);
        QuoteDto.Quote q = quotes.get(0);
        assertThat(q.code()).isEqualTo("005930");
        assertThat(q.price()).isEqualTo(71900);
        assertThat(q.change()).isEqualTo(-100);
        assertThat(q.changeRate()).isEqualTo(-0.14);
        assertThat(q.time()).isEqualTo("093354");
        assertThat(q.source()).isEqualTo("REALTIME");
    }

    @Test
    void 여러건이_이어붙은_메시지는_레코드별로_분리() {
        String msg = "0|H0STCNT0|002|" + record("360750", "100000", "19850", "2", "120", "0.61")
                + "^" + record("360750", "100001", "19855", "2", "125", "0.63");

        List<QuoteDto.Quote> quotes = KisMessageParser.parseTrade(msg);

        assertThat(quotes).extracting(QuoteDto.Quote::price).containsExactly(19850L, 19855L);
        assertThat(quotes).extracting(QuoteDto.Quote::change).containsExactly(120L, 125L);
    }

    @Test
    void 부호값으로_등락_방향을_정함_보합은_0() {
        // 대비 값이 부호 없이 와도 부호 필드(5=하락)를 따른다
        assertThat(KisMessageParser.parseTrade("0|H0STCNT0|001|" + record("005930", "090000", "70000", "5", "500", "0.71")).get(0).change())
                .isEqualTo(-500);
        assertThat(KisMessageParser.parseTrade("0|H0STCNT0|001|" + record("005930", "090000", "70000", "3", "0", "0.00")).get(0).change())
                .isZero();
    }

    @Test
    void JSON_다른TR_깨진메시지는_무시() {
        assertThat(KisMessageParser.parseTrade("{\"header\":{\"tr_id\":\"PINGPONG\"}}")).isEmpty();
        assertThat(KisMessageParser.parseTrade("0|H0STASP0|001|005930^1^2^3^4^5")).isEmpty();
        assertThat(KisMessageParser.parseTrade("1|H0STCNT0|001|암호화된데이터")).isEmpty();
        assertThat(KisMessageParser.parseTrade("0|H0STCNT0|abc|1^2^3^4^5^6")).isEmpty();
        assertThat(KisMessageParser.parseTrade(null)).isEmpty();
    }

    @Test
    void 정규장_시간_판정() {
        ZoneId kst = ZoneId.of("Asia/Seoul");
        // 2026-10-28은 수요일
        assertThat(QuoteService.isMarketOpen(ZonedDateTime.of(2026, 10, 28, 8, 59, 0, 0, kst))).isFalse();
        assertThat(QuoteService.isMarketOpen(ZonedDateTime.of(2026, 10, 28, 9, 0, 0, 0, kst))).isTrue();
        assertThat(QuoteService.isMarketOpen(ZonedDateTime.of(2026, 10, 28, 15, 29, 59, 0, kst))).isTrue();
        assertThat(QuoteService.isMarketOpen(ZonedDateTime.of(2026, 10, 28, 15, 30, 0, 0, kst))).isFalse();
        assertThat(QuoteService.isMarketOpen(ZonedDateTime.of(2026, 10, 31, 10, 0, 0, 0, kst))).isFalse(); // 토요일
    }

    @Test
    void 종목코드_정규화와_검증() {
        assertThat(InvestService.normalizeStockCode(" 360750 ")).isEqualTo("360750");
        assertThat(InvestService.normalizeStockCode("0001a0")).isEqualTo("0001A0");
        assertThat(InvestService.normalizeStockCode("")).isNull();
        assertThat(InvestService.normalizeStockCode(null)).isNull();
        assertThatThrownBy(() -> InvestService.normalizeStockCode("12345")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> InvestService.normalizeStockCode("TIGER 미국")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 네이버_시세_응답_파싱_부호와_가격() throws Exception {
        String body = """
            {"pollingInterval":70000,"datas":[
              {"itemCode":"360750","closePriceRaw":"25655","compareToPreviousClosePriceRaw":"430",
               "compareToPreviousPrice":{"code":"2"},"fluctuationsRatioRaw":"1.70","localTradedAt":"2026-10-28T15:30:00+09:00"},
              {"itemCode":"091160","closePriceRaw":"47,120","compareToPreviousClosePriceRaw":"-880",
               "compareToPreviousPrice":{"code":"5"},"fluctuationsRatioRaw":"-1.83","localTradedAt":"2026-10-28T10:05:12+09:00"},
              {"itemCode":"999999","closePriceRaw":"0","compareToPreviousPrice":{"code":"3"}}
            ]}
            """;

        List<QuoteDto.Quote> quotes = NaverQuoteClient.parse(new com.fasterxml.jackson.databind.ObjectMapper(), body);

        assertThat(quotes).hasSize(2); // 가격 0인 종목 제외
        assertThat(quotes.get(0)).isEqualTo(new QuoteDto.Quote("360750", 25655, 430, 1.70, "153000", "NAVER"));
        QuoteDto.Quote down = quotes.get(1);
        assertThat(down.price()).isEqualTo(47120);
        assertThat(down.change()).isEqualTo(-880);
        assertThat(down.changeRate()).isEqualTo(-1.83);
        assertThat(down.time()).isEqualTo("100512");
    }
}
