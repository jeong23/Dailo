package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.HabitDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.HabitService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/habits")
@RequiredArgsConstructor
public class HabitController {

    private final HabitService habitService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<HabitDto.Response>>> findAll(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(habitService.findAll(userDetails.getMemberId())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<HabitDto.Response>> create(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody HabitDto.Request request) {
        return ResponseEntity.ok(ApiResponse.ok(habitService.create(userDetails.getMemberId(), request)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<HabitDto.Response>> update(
            @PathVariable Long id, @RequestBody HabitDto.Request request) {
        return ResponseEntity.ok(ApiResponse.ok(habitService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        habitService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @GetMapping("/logs")
    public ResponseEntity<ApiResponse<List<HabitDto.LogResponse>>> findLogs(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam int year, @RequestParam int month) {
        return ResponseEntity.ok(ApiResponse.ok(
                habitService.findMonthLogs(userDetails.getMemberId(), year, month)
        ));
    }

    @PostMapping("/logs")
    public ResponseEntity<ApiResponse<Void>> toggleLog(@RequestBody HabitDto.LogRequest request) {
        habitService.toggleLog(request.getHabitId(), request.getLogDate());
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}