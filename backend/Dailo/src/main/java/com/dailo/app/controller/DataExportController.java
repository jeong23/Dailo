package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.DataExportDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.DataExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

// 내 데이터 내보내기(백업) — 본인 데이터만 (memberId는 토큰에서)
@RestController
@RequestMapping("/api/export")
@RequiredArgsConstructor
public class DataExportController {

    private final DataExportService exportService;

    @GetMapping("/items")
    public ResponseEntity<ApiResponse<List<DataExportDto.Item>>> items(@AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(exportService.items(user.getMemberId())));
    }

    // ?items=ledger,invest → ZIP 파일 (ApiResponse 아님 — 파일 다운로드)
    @GetMapping
    public ResponseEntity<byte[]> export(@AuthenticationPrincipal CustomUserDetails user,
                                         @RequestParam(name = "items", required = false) List<String> items) {
        byte[] zip = exportService.export(user.getMemberId(), items);
        String name = "dailo-backup-" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + ".zip";
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(name, StandardCharsets.UTF_8).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store") // 금융 기록 — 브라우저·프록시 캐시에 남기지 않음
                .body(zip);
    }
}
