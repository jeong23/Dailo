package com.dailo.app.service;

import com.dailo.app.dto.DailyExpenseRequestDto;
import com.dailo.app.dto.HabitDto;
import com.dailo.app.dto.IncomeRequestDto;
import com.dailo.app.entity.*;
import com.dailo.app.repository.*;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

// IDOR 방지 (2026-10-29): 지출·수입·습관을 id만으로 다른 회원 것을 조회·수정·삭제할 수 없어야 한다
class LedgerOwnershipGuardTest {

    private static final Long ME = 1L;
    private static final Long OTHER = 2L;

    private final DailyExpenseRepository expenseRepo = mock(DailyExpenseRepository.class);
    private final MonthlyBudgetRepository budgetRepo = mock(MonthlyBudgetRepository.class);
    private final DailyExpenseService expenseService = new DailyExpenseService(expenseRepo, budgetRepo, mock(CategoryRepository.class), mock(CashAccountRepository.class), mock(SavingsRepository.class));

    private final IncomeRepository incomeRepo = mock(IncomeRepository.class);
    private final IncomeService incomeService = new IncomeService(incomeRepo, mock(MemberRepository.class), mock(CashAccountRepository.class));

    private final HabitRepository habitRepo = mock(HabitRepository.class);
    private final HabitLogRepository habitLogRepo = mock(HabitLogRepository.class);
    private final HabitService habitService = new HabitService(habitRepo, habitLogRepo);

    private Member member(Long id) {
        Member m = mock(Member.class);
        when(m.getId()).thenReturn(id);
        return m;
    }

    private MonthlyBudget budgetOf(Long memberId) {
        MonthlyBudget b = mock(MonthlyBudget.class);
        Member m = member(memberId);
        when(b.getMember()).thenReturn(m);
        return b;
    }

    private DailyExpense expenseOf(Long memberId) {
        DailyExpense e = mock(DailyExpense.class);
        MonthlyBudget b = budgetOf(memberId);
        when(e.getMonthlyBudget()).thenReturn(b);
        return e;
    }

    @Test
    void 다른_회원의_지출은_조회할_수_없다() {
        DailyExpense e = expenseOf(OTHER);
        when(expenseRepo.findById(3L)).thenReturn(Optional.of(e));
        assertThatThrownBy(() -> expenseService.findById(ME, 3L)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 다른_회원의_지출은_삭제할_수_없다() {
        DailyExpense e = expenseOf(OTHER);
        when(expenseRepo.findById(3L)).thenReturn(Optional.of(e));
        assertThatThrownBy(() -> expenseService.delete(ME, 3L)).isInstanceOf(IllegalArgumentException.class);
        verify(expenseRepo, never()).delete(any());
        verify(expenseRepo, never()).deleteById(any());
    }

    @Test
    void 다른_회원의_지출은_수정할_수_없다() {
        DailyExpense e = expenseOf(OTHER);
        when(expenseRepo.findById(3L)).thenReturn(Optional.of(e));
        assertThatThrownBy(() -> expenseService.update(ME, 3L, mock(DailyExpenseRequestDto.class)))
                .isInstanceOf(IllegalArgumentException.class);
        verify(e, never()).update(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void 내_지출은_삭제된다() {
        DailyExpense e = expenseOf(ME);
        when(expenseRepo.findById(3L)).thenReturn(Optional.of(e));
        expenseService.delete(ME, 3L);
        verify(expenseRepo).delete(e);
    }

    @Test
    void 남의_월별예산으로_지출을_등록하거나_목록을_볼_수_없다() {
        MonthlyBudget other = budgetOf(OTHER);
        when(budgetRepo.findById(7L)).thenReturn(Optional.of(other));
        DailyExpenseRequestDto req = mock(DailyExpenseRequestDto.class);
        when(req.getMonthlyBudgetId()).thenReturn(7L);

        assertThatThrownBy(() -> expenseService.create(ME, req)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> expenseService.findByMonthlyBudgetId(ME, 7L)).isInstanceOf(IllegalArgumentException.class);
        verify(expenseRepo, never()).save(any());
    }

    @Test
    void 다른_회원의_수입은_삭제할_수_없다() {
        Income income = mock(Income.class);
        Member other = member(OTHER);
        when(income.getMember()).thenReturn(other);
        when(incomeRepo.findById(4L)).thenReturn(Optional.of(income));

        assertThatThrownBy(() -> incomeService.delete(ME, 4L)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> incomeService.update(ME, 4L, mock(IncomeRequestDto.class))).isInstanceOf(IllegalArgumentException.class);
        verify(incomeRepo, never()).delete(any());
    }

    @Test
    void 다른_회원의_습관은_수정_삭제_체크할_수_없다() {
        Habit habit = mock(Habit.class);
        when(habit.getMemberId()).thenReturn(OTHER);
        when(habitRepo.findById(9L)).thenReturn(Optional.of(habit));
        LocalDate d = LocalDate.of(2026, 10, 29);

        assertThatThrownBy(() -> habitService.delete(ME, 9L)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> habitService.update(ME, 9L, mock(HabitDto.Request.class))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> habitService.toggleLog(ME, 9L, d)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> habitService.incrementLog(ME, 9L, d)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> habitService.decrementLog(ME, 9L, d)).isInstanceOf(IllegalArgumentException.class);
        verify(habitRepo, never()).delete(any());
        verify(habitLogRepo, never()).save(any());
        verify(habitLogRepo, never()).delete(any());
    }
}
