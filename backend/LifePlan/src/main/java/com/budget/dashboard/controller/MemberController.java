package com.budget.dashboard.controller;

import com.budget.dashboard.common.ApiResponse;
import com.budget.dashboard.dto.MemberRequestDto;
import com.budget.dashboard.dto.MemberResponseDto;
import com.budget.dashboard.service.MemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @PostMapping
    public ResponseEntity<ApiResponse<MemberResponseDto>> create(@RequestBody MemberRequestDto request) {
        MemberResponseDto response = memberService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("회원이 생성되었습니다.", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MemberResponseDto>> findById(@PathVariable Long id) {
        MemberResponseDto response = memberService.findById(id);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<MemberResponseDto>>> findAll() {
        List<MemberResponseDto> response = memberService.findAll();
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<MemberResponseDto>> update(
            @PathVariable Long id,
            @RequestBody MemberRequestDto request) {
        MemberResponseDto response = memberService.update(id, request);
        return ResponseEntity.ok(ApiResponse.ok("회원 정보가 수정되었습니다.", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        memberService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("회원이 삭제되었습니다.", null));
    }
}