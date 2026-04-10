package com.budget.dashboard.controller;

import com.budget.dashboard.common.ApiResponse;
import com.budget.dashboard.dto.CategoryRequestDto;
import com.budget.dashboard.dto.CategoryResponseDto;
import com.budget.dashboard.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @PostMapping
    public ResponseEntity<ApiResponse<CategoryResponseDto>> create(@RequestBody CategoryRequestDto request) {
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
            @PathVariable Long id,
            @RequestBody CategoryRequestDto request) {
        CategoryResponseDto response = categoryService.update(id, request);
        return ResponseEntity.ok(ApiResponse.ok("카테고리가 수정되었습니다.", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        categoryService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("카테고리가 삭제되었습니다.", null));
    }
}