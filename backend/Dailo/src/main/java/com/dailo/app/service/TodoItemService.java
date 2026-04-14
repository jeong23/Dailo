package com.dailo.app.service;

import com.dailo.app.dto.TodoItemDto;
import com.dailo.app.entity.TodoItem;
import com.dailo.app.repository.TodoItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TodoItemService {

    private final TodoItemRepository todoItemRepository;

    public List<TodoItemDto.Response> findByDate(LocalDate date) {
        return todoItemRepository.findByPlanDateOrderBySortOrderAsc(date).stream()
                .map(TodoItemDto.Response::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public TodoItemDto.Response create(TodoItemDto.Request request) {
        TodoItem item = TodoItem.builder()
                .planDate(request.getPlanDate())
                .content(request.getContent())
                .type(request.getType())
                .isDone(false)
                .sortOrder(request.getSortOrder())
                .build();
        return TodoItemDto.Response.from(todoItemRepository.save(item));
    }

    @Transactional
    public TodoItemDto.Response update(Long id, TodoItemDto.UpdateRequest request) {
        TodoItem item = todoItemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("할 일을 찾을 수 없습니다: " + id));
        item.update(request.getContent(), request.getIsDone());
        return TodoItemDto.Response.from(item);
    }

    @Transactional
    public void delete(Long id) {
        if (!todoItemRepository.existsById(id)) {
            throw new IllegalArgumentException("할 일을 찾을 수 없습니다: " + id);
        }
        todoItemRepository.deleteById(id);
    }
}
