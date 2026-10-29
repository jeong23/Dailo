package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.VisionBoardDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.VisionBoardService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// 미래 시각화 보드 — 사진 여러 장을 자유 배치 (이미지 파일 업로드는 POST /api/daily-plans/upload-image)
@RestController
@RequestMapping("/api/vision-board")
@RequiredArgsConstructor
public class VisionBoardController {

    private final VisionBoardService visionBoardService;

    @GetMapping
    public ApiResponse<List<VisionBoardDto.Response>> getItems(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ApiResponse.ok(visionBoardService.findAll(userDetails.getMemberId()));
    }

    @PostMapping
    public ApiResponse<VisionBoardDto.Response> create(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody VisionBoardDto.Request req) {
        return ApiResponse.ok(visionBoardService.create(userDetails.getMemberId(), req));
    }

    @PutMapping("/{id}")
    public ApiResponse<VisionBoardDto.Response> update(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id, @RequestBody VisionBoardDto.Request req) {
        return ApiResponse.ok(visionBoardService.update(userDetails.getMemberId(), id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id) {
        visionBoardService.delete(userDetails.getMemberId(), id);
        return ApiResponse.ok(null);
    }
}
