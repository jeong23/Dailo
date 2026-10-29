package com.dailo.app.repository;

import com.dailo.app.entity.TodoItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface TodoItemRepository extends JpaRepository<TodoItem, Long> {
    List<TodoItem> findByMemberIdAndPlanDateOrderBySortOrderAsc(Long memberId, LocalDate planDate);
    List<TodoItem> findByMemberIdAndPlanDateBetweenAndType(Long memberId, LocalDate start, LocalDate end, String type);
}
