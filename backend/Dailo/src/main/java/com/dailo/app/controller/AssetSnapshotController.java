package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.AssetSnapshotDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.AssetSnapshotService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// 순자산 추이 — 본인 것만 (memberId는 토큰에서)
@RestController
@RequestMapping("/api/assets/snapshots")
@RequiredArgsConstructor
public class AssetSnapshotController {

    private final AssetSnapshotService snapshotService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<AssetSnapshotDto.Response>>> list(@AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(ApiResponse.ok(snapshotService.findAll(user.getMemberId())));
    }

    // 이번 정산월 기록(덮어쓰기). 정산월은 서버가 정함
    @PutMapping("/current")
    public ResponseEntity<ApiResponse<AssetSnapshotDto.Response>> recordCurrent(@AuthenticationPrincipal CustomUserDetails user,
                                                                                @Valid @RequestBody AssetSnapshotDto.Request req) {
        return ResponseEntity.ok(ApiResponse.ok(snapshotService.recordCurrent(user.getMemberId(), req)));
    }
}
