package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.CategoryRequestDto;
import com.dailo.app.dto.CategoryResponseDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

// 카테고리는 전 회원 공용 — 조회는 누구나, 생성·수정·삭제는 관리자(member.role=ADMIN)만
//  예전엔 로그인한 누구나 지울 수 있어 다른 회원 지출 분류가 깨질 수 있었음
@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @PostMapping
    public ResponseEntity<ApiResponse<CategoryResponseDto>> create(
            @AuthenticationPrincipal CustomUserDetails user, @RequestBody CategoryRequestDto request) {
        requireAdmin(user);
        CategoryResponseDto response = categoryService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("카테고리가 생성되었습니다.", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<CategoryResponseDto>> findById(@PathVariable Long id) {
        CategoryResponseDto response = categoryService.findById(id);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<CategoryResponseDto>>> findAll() {
        List<CategoryResponseDto> response = categoryService.findAll();
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<CategoryResponseDto>> update(
            @AuthenticationPrincipal CustomUserDetails user,
            @PathVariable Long id,
            @RequestBody CategoryRequestDto request) {
        requireAdmin(user);
        CategoryResponseDto response = categoryService.update(id, request);
        return ResponseEntity.ok(ApiResponse.ok("카테고리가 수정되었습니다.", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@AuthenticationPrincipal CustomUserDetails user, @PathVariable Long id) {
        requireAdmin(user);
        categoryService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("카테고리가 삭제되었습니다.", null));
    }

    private static void requireAdmin(CustomUserDetails user) {
        if (user == null || !user.isAdmin()) throw new AccessDeniedException("카테고리는 관리자만 바꿀 수 있어요");
    }
}
