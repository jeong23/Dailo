package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.WorkoutLogDto;
import com.dailo.app.dto.WorkoutRoutineDto;
import com.dailo.app.security.CustomUserDetails;
import com.dailo.app.service.WorkoutService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/workouts")
@RequiredArgsConstructor
public class WorkoutController {

    private final WorkoutService workoutService;

    // ── Routine ───────────────────────────

    @GetMapping("/routines")
    public ApiResponse<List<WorkoutRoutineDto.RoutineResponse>> getRoutines(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ApiResponse.ok(workoutService.findRoutines(userDetails.getMemberId()));
    }

    @PostMapping("/routines")
    public ApiResponse<List<WorkoutRoutineDto.RoutineResponse>> saveRoutines(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody List<WorkoutRoutineDto.RoutineRequest> req) {
        return ApiResponse.ok(workoutService.saveRoutines(userDetails.getMemberId(), req));
    }

    // ── Log ───────────────────────────────

    @GetMapping("/logs")
    public ApiResponse<List<WorkoutLogDto.LogResponse>> getLogs(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam int year, @RequestParam int month) {
        return ApiResponse.ok(workoutService.findLogs(userDetails.getMemberId(), year, month));
    }

    @PostMapping("/logs")
    public ApiResponse<WorkoutLogDto.LogResponse> saveLog(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody WorkoutLogDto.LogRequest req) {
        return ApiResponse.ok(workoutService.saveLog(userDetails.getMemberId(), req));
    }

    @DeleteMapping("/logs/{id}")
    public ApiResponse<Void> deleteLog(@PathVariable Long id) {
        workoutService.deleteLog(id);
        return ApiResponse.ok(null);
    }

    // ── 종목명 자동완성 ─────────────────────

    @GetMapping("/exercise-names")
    public ApiResponse<List<String>> getExerciseNames(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(required = false) String query) {
        return ApiResponse.ok(workoutService.findExerciseNames(userDetails.getMemberId(), query));
    }
}
