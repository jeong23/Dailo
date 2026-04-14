package com.dailo.app.controller;

import com.dailo.app.common.ApiResponse;
import com.dailo.app.dto.TodoItemDto;
import com.dailo.app.service.TodoItemService;
import lombok.RequiredArgsConstructor;
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
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ApiResponse.ok(todoItemService.findByDate(date));
    }

    @PostMapping
    public ApiResponse<TodoItemDto.Response> create(@RequestBody TodoItemDto.Request request) {
        return ApiResponse.ok(todoItemService.create(request));
    }

    @PutMapping("/{id}")
    public ApiResponse<TodoItemDto.Response> update(
            @PathVariable Long id,
            @RequestBody TodoItemDto.UpdateRequest request) {
        return ApiResponse.ok(todoItemService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        todoItemService.delete(id);
        return ApiResponse.ok(null);
    }
}
