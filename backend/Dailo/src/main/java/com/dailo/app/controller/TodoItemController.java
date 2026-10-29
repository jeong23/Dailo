package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.TodoItemDto;
import com.dailo.app.service.TodoItemService;
import com.dailo.app.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/todo-items")
@RequiredArgsConstructor
public class TodoItemController {

    private final TodoItemService todoItemService;

    @GetMapping
    public ApiResponse<List<TodoItemDto.Response>> findByDate(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.ok(todoItemService.findByDate(userDetails.getMemberId(), date));
    }

    @PostMapping
    public ApiResponse<TodoItemDto.Response> create(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody TodoItemDto.Request request) {
        return ApiResponse.ok(todoItemService.create(userDetails.getMemberId(), request));
    }

    @PutMapping("/{id}")
    public ApiResponse<TodoItemDto.Response> update(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id,
            @RequestBody TodoItemDto.UpdateRequest request) {
        return ApiResponse.ok(todoItemService.update(userDetails.getMemberId(), id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long id) {
        todoItemService.delete(userDetails.getMemberId(), id);
        return ApiResponse.ok(null);
    }
}
