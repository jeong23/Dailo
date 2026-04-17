package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.TimeBoxBlockDto;
import com.dailo.app.service.TimeBoxBlockService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/time-box-blocks")
@RequiredArgsConstructor
public class TimeBoxBlockController {

    private final TimeBoxBlockService blockService;

    @GetMapping
    public ApiResponse<List<TimeBoxBlockDto.Response>> getBlocks(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.ok(blockService.findByDate(date));
    }

    @PostMapping
    public ApiResponse<TimeBoxBlockDto.Response> create(@RequestBody TimeBoxBlockDto.Request req) {
        return ApiResponse.ok(blockService.create(req));
    }

    @PutMapping("/{id}")
    public ApiResponse<TimeBoxBlockDto.Response> update(
            @PathVariable Long id, @RequestBody TimeBoxBlockDto.Request req) {
        return ApiResponse.ok(blockService.update(id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        blockService.delete(id);
        return ApiResponse.ok(null);
    }
}
