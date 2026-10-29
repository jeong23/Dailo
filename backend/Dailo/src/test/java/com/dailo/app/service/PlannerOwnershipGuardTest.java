package com.dailo.app.service;

import com.dailo.app.dto.DailyPlanDto;
import com.dailo.app.dto.TimeBoxBlockDto;
import com.dailo.app.dto.TimeBoxSlotDto;
import com.dailo.app.dto.TodoItemDto;
import com.dailo.app.entity.*;
import com.dailo.app.repository.*;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

// IDOR 방지: 플래너(데일리 플랜·할 일·타임박스 슬롯/블록)는 로그인 회원 것만 조회·수정·삭제할 수 있어야 한다
class PlannerOwnershipGuardTest {

    private static final Long ME = 1L;
    private static final Long OTHER = 2L;
    private static final LocalDate DATE = LocalDate.of(2026, 10, 28);

    private final DailyPlanRepository planRepo = mock(DailyPlanRepository.class);
    private final TodoItemRepository todoRepo = mock(TodoItemRepository.class);
    private final TimeBoxSlotRepository slotRepo = mock(TimeBoxSlotRepository.class);
    private final TimeBoxBlockRepository blockRepo = mock(TimeBoxBlockRepository.class);

    private final DailyPlanService dailyPlanService = new DailyPlanService(planRepo, todoRepo);
    private final TodoItemService todoItemService = new TodoItemService(todoRepo);
    private final TimeBoxSlotService timeBoxSlotService = new TimeBoxSlotService(slotRepo);
    private final TimeBoxBlockService timeBoxBlockService = new TimeBoxBlockService(blockRepo);

    // ── 할 일 ──

    @Test
    void 다른_회원의_할일은_수정할_수_없다() {
        TodoItem item = mock(TodoItem.class);
        when(item.getMemberId()).thenReturn(OTHER);
        when(todoRepo.findById(3L)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> todoItemService.update(ME, 3L, mock(TodoItemDto.UpdateRequest.class)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("할 일을 찾을 수 없습니다: 3");
        verify(item, never()).update(any(), any());
        verify(item, never()).updateType(any());
        verify(item, never()).updateSortOrder(any());
    }

    @Test
    void 다른_회원의_할일은_삭제할_수_없다() {
        TodoItem item = mock(TodoItem.class);
        when(item.getMemberId()).thenReturn(OTHER);
        when(todoRepo.findById(3L)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> todoItemService.delete(ME, 3L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("할 일을 찾을 수 없습니다: 3");
        verify(todoRepo, never()).delete(any());
        verify(todoRepo, never()).deleteById(any());
    }

    @Test
    void 내_할일은_수정되고_삭제된다() {
        TodoItem item = mock(TodoItem.class);
        when(item.getMemberId()).thenReturn(ME);
        when(todoRepo.findById(3L)).thenReturn(Optional.of(item));

        todoItemService.update(ME, 3L, mock(TodoItemDto.UpdateRequest.class));
        verify(item).update(any(), any());

        todoItemService.delete(ME, 3L);
        verify(todoRepo).delete(item);
    }

    @Test
    void 할일은_내_회원id로_저장되고_내_것만_조회된다() {
        TodoItemDto.Request req = mock(TodoItemDto.Request.class);
        when(req.getPlanDate()).thenReturn(DATE);
        when(req.getContent()).thenReturn("운동");
        when(req.getType()).thenReturn("BIG3");
        when(todoRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        todoItemService.create(ME, req);
        verify(todoRepo).save(argThat(t -> t.getMemberId().equals(ME)));

        todoItemService.findByDate(ME, DATE);
        verify(todoRepo).findByMemberIdAndPlanDateOrderBySortOrderAsc(ME, DATE);
        verify(todoRepo, never()).findByMemberIdAndPlanDateOrderBySortOrderAsc(eq(OTHER), any());
    }

    // ── 타임박스 블록 ──

    @Test
    void 다른_회원의_블록은_수정할_수_없다() {
        TimeBoxBlock block = mock(TimeBoxBlock.class);
        when(block.getMemberId()).thenReturn(OTHER);
        when(blockRepo.findById(4L)).thenReturn(Optional.of(block));

        assertThatThrownBy(() -> timeBoxBlockService.update(ME, 4L, mock(TimeBoxBlockDto.Request.class)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("블록을 찾을 수 없습니다: 4");
        verify(block, never()).update(any(), any());
    }

    @Test
    void 다른_회원의_블록은_삭제할_수_없다() {
        TimeBoxBlock block = mock(TimeBoxBlock.class);
        when(block.getMemberId()).thenReturn(OTHER);
        when(blockRepo.findById(4L)).thenReturn(Optional.of(block));

        assertThatThrownBy(() -> timeBoxBlockService.delete(ME, 4L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("블록을 찾을 수 없습니다: 4");
        verify(blockRepo, never()).delete(any());
        verify(blockRepo, never()).deleteById(any());
    }

    @Test
    void 내_블록은_삭제되고_새_블록은_내_회원id로_저장된다() {
        TimeBoxBlock block = mock(TimeBoxBlock.class);
        when(block.getMemberId()).thenReturn(ME);
        when(blockRepo.findById(4L)).thenReturn(Optional.of(block));
        timeBoxBlockService.delete(ME, 4L);
        verify(blockRepo).delete(block);

        when(blockRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        timeBoxBlockService.create(ME, mock(TimeBoxBlockDto.Request.class));
        verify(blockRepo).save(argThat(b -> b.getMemberId().equals(ME)));
    }

    // ── 타임박스 슬롯 (date+hour upsert) ──

    @Test
    void 슬롯_upsert는_다른_회원의_같은_시간_슬롯을_덮어쓰지_않는다() {
        TimeBoxSlotDto.Request req = mock(TimeBoxSlotDto.Request.class);
        when(req.getPlanDate()).thenReturn(DATE);
        when(req.getHour()).thenReturn(9);
        TimeBoxSlot othersSlot = mock(TimeBoxSlot.class);
        when(slotRepo.findByMemberIdAndPlanDateAndHour(OTHER, DATE, 9)).thenReturn(Optional.of(othersSlot));
        when(slotRepo.findByMemberIdAndPlanDateAndHour(ME, DATE, 9)).thenReturn(Optional.empty());
        when(slotRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        timeBoxSlotService.upsert(ME, req);

        verify(othersSlot, never()).update(any(), any(), any(), any());
        verify(slotRepo).save(argThat(s -> s.getMemberId().equals(ME) && s.getHour() == 9));
    }

    // ── 데일리 플랜 (date upsert) / 월간 보드 ──

    @Test
    void 플랜_upsert는_다른_회원의_같은_날짜_플랜을_덮어쓰지_않는다() {
        DailyPlanDto.Request req = DailyPlanDto.Request.builder().planDate(DATE).identity1("나").build();
        DailyPlan othersPlan = mock(DailyPlan.class);
        when(planRepo.findByMemberIdAndPlanDate(OTHER, DATE)).thenReturn(Optional.of(othersPlan));
        when(planRepo.findByMemberIdAndPlanDate(ME, DATE)).thenReturn(Optional.empty());
        when(planRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        dailyPlanService.upsert(ME, req);

        verify(othersPlan, never()).update(any(), any(), any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(), any());
        verify(planRepo).save(argThat(p -> p.getMemberId().equals(ME) && p.getPlanDate().equals(DATE)));
    }

    @Test
    void 플랜_조회와_월간_보드는_내_회원id로만_조회한다() {
        dailyPlanService.findByDate(ME, DATE);
        dailyPlanService.findMonthlyBoard(ME, 2026, 10);

        LocalDate start = LocalDate.of(2026, 10, 1);
        LocalDate end = LocalDate.of(2026, 10, 31);
        verify(planRepo).findByMemberIdAndPlanDate(ME, DATE);
        verify(planRepo).findByMemberIdAndPlanDateBetweenOrderByPlanDateAsc(ME, start, end);
        verify(todoRepo).findByMemberIdAndPlanDateBetweenAndType(ME, start, end, "BIG3");
        verify(todoRepo).findByMemberIdAndPlanDateBetweenAndType(ME, start, end, "BRAIN_DUMP");
        verify(planRepo, never()).findByMemberIdAndPlanDateBetweenOrderByPlanDateAsc(eq(OTHER), any(), any());
        verify(todoRepo, never()).findByMemberIdAndPlanDateBetweenAndType(eq(OTHER), any(), any(), any());
    }
}
