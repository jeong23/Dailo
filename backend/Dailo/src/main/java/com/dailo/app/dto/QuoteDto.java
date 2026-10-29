package com.dailo.app.dto;

import java.util.Map;

public class QuoteDto {

    /**
     * 종목 1개의 시세.
     * change/changeRate는 전일 대비 부호 포함 값, time은 체결 시각 HHmmss (REST 스냅샷이면 null),
     * source는 REALTIME(웹소켓 체결) / SNAPSHOT(REST 현재가 조회) / NAVER(네이버 폴링, KIS 키 없을 때)
     */
    public record Quote(String code, long price, long change, double changeRate, String time, String source) {
    }

    /**
     * 연결 상태 — configured: KIS 키 설정됨, connected: 시세 소스 연결됨(KIS 웹소켓 / 네이버 마지막 조회 성공),
     * marketOpen: 정규장 시간(평일 09:00~15:30, 휴장일 미반영), provider: KIS / NAVER / NONE
     */
    public record Status(boolean configured, boolean connected, boolean marketOpen, String provider) {
    }

    /** GET /api/invest/quotes 및 SSE 첫 이벤트 */
    public record Snapshot(Status status, Map<String, Quote> quotes) {
    }
}
