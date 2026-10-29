package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.QuoteDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.QuoteService;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/invest/quotes")
@RequiredArgsConstructor
public class InvestQuoteController {

    private final QuoteService quoteService;

    // 현재 캐시된 본인 종목 시세 + 연결 상태
    @GetMapping
    public ResponseEntity<ApiResponse<QuoteDto.Snapshot>> getQuotes(
            @AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(quoteService.snapshot(user.getMemberId())));
    }

    // 실시간 시세 스트림 (Server-Sent Events) — 프론트는 Authorization 헤더를 실을 수 있게 fetch 스트리밍으로 구독
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@AuthenticationPrincipal CustomUserDetails user, HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("X-Accel-Buffering", "no"); // 프록시가 버퍼링하지 않고 바로 흘려보내도록
        return quoteService.subscribe(user.getMemberId());
    }
}
