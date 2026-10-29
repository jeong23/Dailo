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

    public List<TodoItemDto.Response> findByDate(Long memberId, LocalDate date) {
        return todoItemRepository.findByMemberIdAndPlanDateOrderBySortOrderAsc(memberId, date).stream()
                .map(TodoItemDto.Response::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public TodoItemDto.Response create(Long memberId, TodoItemDto.Request request) {
        TodoItem item = TodoItem.builder()
                .memberId(memberId)
                .planDate(request.getPlanDate())
                .content(request.getContent())
                .type(request.getType())
                .isDone(false)
                .sortOrder(request.getSortOrder())
                .build();
        return TodoItemDto.Response.from(todoItemRepository.save(item));
    }

    @Transactional
    public TodoItemDto.Response update(Long memberId, Long id, TodoItemDto.UpdateRequest request) {
        TodoItem item = findOwned(memberId, id);
        item.update(request.getContent(), request.getIsDone());
        if (request.getType() != null) item.updateType(request.getType());
        if (request.getSortOrder() != null) item.updateSortOrder(request.getSortOrder());
        return TodoItemDto.Response.from(item);
    }

    @Transactional
    public void delete(Long memberId, Long id) {
        todoItemRepository.delete(findOwned(memberId, id));
    }

    private TodoItem findOwned(Long memberId, Long id) {
        TodoItem item = todoItemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("할 일을 찾을 수 없습니다: " + id));
        // 다른 회원의 할 일 수정·삭제 방지 (IDOR)
        if (!item.getMemberId().equals(memberId)) {
            throw new IllegalArgumentException("할 일을 찾을 수 없습니다: " + id);
        }
        return item;
    }
}
