package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.MemberNoteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

// 회원 메모 — 키는 budget-YYYY-MM / planner-YYYY-MM. 본인 것만 (memberId는 토큰에서)
@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
public class MemberNoteController {

    private final MemberNoteService noteService;

    @GetMapping("/{key}")
    public ResponseEntity<ApiResponse<String>> get(@AuthenticationPrincipal CustomUserDetails user, @PathVariable String key) {
        return ResponseEntity.ok(ApiResponse.ok(noteService.get(user.getMemberId(), key)));
    }

    @PutMapping("/{key}")
    public ResponseEntity<ApiResponse<Void>> save(@AuthenticationPrincipal CustomUserDetails user, @PathVariable String key,
                                                  @RequestBody Map<String, String> body) {
        noteService.save(user.getMemberId(), key, body.get("content"));
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
