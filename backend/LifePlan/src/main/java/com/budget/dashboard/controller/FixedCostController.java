package com.budget.dashboard.controller;

import com.budget.dashboard.common.ApiResponse;
import com.budget.dashboard.dto.FixedCostRequestDto;
import com.budget.dashboard.dto.FixedCostResponseDto;
import com.budget.dashboard.service.FixedCostService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/fixed-costs")
@RequiredArgsConstructor
public class FixedCostController {

    private final FixedCostService fixedCostService;

    @PostMapping
    public ResponseEntity<ApiResponse<FixedCostResponseDto>> create(@RequestBody FixedCostRequestDto request) {
        FixedCostResponseDto response = fixedCostService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("고정비가 생성되었습니다.", response));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<FixedCostResponseDto>> findById(@PathVariable Long id) {
        FixedCostResponseDto response = fixedCostService.findById(id);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/member/{memberId}")
    public ResponseEntity<ApiResponse<List<FixedCostResponseDto>>> findByMemberId(@PathVariable Long memberId) {
        List<FixedCostResponseDto> response = fixedCostService.findByMemberId(memberId);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @GetMapping("/member/{memberId}/active")
    public ResponseEntity<ApiResponse<List<FixedCostResponseDto>>> findActiveByMemberId(@PathVariable Long memberId) {
        List<FixedCostResponseDto> response = fixedCostService.findActiveByMemberId(memberId);
        return ResponseEntity.ok(ApiResponse.ok(response));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<FixedCostResponseDto>> update(
            @PathVariable Long id,
            @RequestBody FixedCostRequestDto request) {
        FixedCostResponseDto response = fixedCostService.update(id, request);
        return ResponseEntity.ok(ApiResponse.ok("고정비가 수정되었습니다.", response));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        fixedCostService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("고정비가 삭제되었습니다.", null));
    }
}