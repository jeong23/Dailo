package com.dailo.app.service;

import com.dailo.app.dto.InvestDto;
import com.dailo.app.dto.WorkoutLogDto;
import com.dailo.app.entity.*;
import com.dailo.app.repository.*;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

// IDOR 방지: 다른 회원의 투자 기록·일기·운동 기록/세트를 id만으로 수정·삭제할 수 없어야 한다
class OwnershipGuardTest {

    private static final Long ME = 1L;
    private static final Long OTHER = 2L;

    private final InvestMonthlyRecordRepository recordRepo = mock(InvestMonthlyRecordRepository.class);
    private final InvestDiaryRepository diaryRepo = mock(InvestDiaryRepository.class);
    private final InvestService investService = new InvestService(
            mock(InvestSettingRepository.class), mock(InvestAccountRepository.class),
            mock(InvestHoldingRepository.class), recordRepo, diaryRepo,
            mock(org.springframework.context.ApplicationEventPublisher.class),
            mock(InvestThemeRepository.class), mock(MonthlyBudgetRepository.class), mock(BudgetAllocationItemRepository.class));

    private final WorkoutLogRepository logRepo = mock(WorkoutLogRepository.class);
    private final WorkoutSetRepository setRepo = mock(WorkoutSetRepository.class);
    private final WorkoutBookmarkRepository bookmarkRepo = mock(WorkoutBookmarkRepository.class);
    private final WorkoutService workoutService = new WorkoutService(
            mock(WorkoutRoutineRepository.class), mock(WorkoutRoutineExerciseRepository.class), logRepo, setRepo, bookmarkRepo);

    private InvestMonthlyRecord recordOwnedBy(Long memberId) {
        InvestAccount account = mock(InvestAccount.class);
        when(account.getMemberId()).thenReturn(memberId);
        InvestHolding holding = mock(InvestHolding.class);
        when(holding.getAccount()).thenReturn(account);
        InvestMonthlyRecord record = mock(InvestMonthlyRecord.class);
        when(record.getHolding()).thenReturn(holding);
        return record;
    }

    @Test
    void 다른_회원의_투자기록은_수정할_수_없다() {
        InvestMonthlyRecord record = recordOwnedBy(OTHER);
        when(recordRepo.findById(10L)).thenReturn(Optional.of(record));

        assertThatThrownBy(() -> investService.updateRecord(ME, 10L, mock(InvestDto.RecordUpdateRequest.class)))
                .isInstanceOf(IllegalArgumentException.class);
        verify(record, never()).updateActual(any(), any(), any(), any());
    }

    @Test
    void 내_투자기록은_수정된다() {
        InvestMonthlyRecord record = recordOwnedBy(ME);
        when(recordRepo.findById(10L)).thenReturn(Optional.of(record));

        investService.updateRecord(ME, 10L, mock(InvestDto.RecordUpdateRequest.class));
        verify(record).updateActual(any(), any(), any(), any());
    }

    @Test
    void 다른_회원의_일기는_삭제할_수_없다() {
        InvestDiary diary = mock(InvestDiary.class);
        when(diary.getMemberId()).thenReturn(OTHER);
        when(diaryRepo.findById(5L)).thenReturn(Optional.of(diary));

        assertThatThrownBy(() -> investService.deleteDiary(ME, 5L)).isInstanceOf(IllegalArgumentException.class);
        verify(diaryRepo, never()).delete(any());
        verify(diaryRepo, never()).deleteById(any());
    }

    @Test
    void 내_일기는_삭제된다() {
        InvestDiary diary = mock(InvestDiary.class);
        when(diary.getMemberId()).thenReturn(ME);
        when(diaryRepo.findById(5L)).thenReturn(Optional.of(diary));

        investService.deleteDiary(ME, 5L);
        verify(diaryRepo).delete(diary);
    }

    @Test
    void 다른_회원의_운동기록은_삭제할_수_없다() {
        WorkoutLog log = mock(WorkoutLog.class);
        when(log.getMemberId()).thenReturn(OTHER);
        when(logRepo.findById(7L)).thenReturn(Optional.of(log));

        assertThatThrownBy(() -> workoutService.deleteLog(ME, 7L)).isInstanceOf(IllegalArgumentException.class);
        verify(setRepo, never()).deleteByWorkoutLogId(any());
        verify(logRepo, never()).delete(any());
    }

    @Test
    void 다른_기록의_세트_id로는_세트를_덮어쓸_수_없다() {
        LocalDate date = LocalDate.of(2026, 10, 27);
        WorkoutLog myLog = mock(WorkoutLog.class);
        when(myLog.getId()).thenReturn(100L);
        when(logRepo.findByMemberIdAndWorkoutDate(ME, date)).thenReturn(Optional.of(myLog));

        WorkoutLog othersLog = mock(WorkoutLog.class);
        when(othersLog.getId()).thenReturn(200L);
        WorkoutSet othersSet = mock(WorkoutSet.class);
        when(othersSet.getWorkoutLog()).thenReturn(othersLog);
        when(setRepo.findById(999L)).thenReturn(Optional.of(othersSet));

        WorkoutLogDto.SetRequest sr = new WorkoutLogDto.SetRequest(999L, "벤치프레스", 0, 1, 100f, 5, true, "NORMAL");
        WorkoutLogDto.LogRequest req = new WorkoutLogDto.LogRequest(null, date, "", List.of(sr));

        assertThatThrownBy(() -> workoutService.saveLog(ME, req)).isInstanceOf(IllegalArgumentException.class);
        verify(othersSet, never()).update(any(), any(), any(), any(), any(), any(), any());
    }

    // ── 즐겨찾기: 항상 로그인 회원 id로만 조회·저장·삭제 ──

    @Test
    void 즐겨찾기는_내_회원id로_저장되고_중복_저장되지_않는다() {
        when(bookmarkRepo.findByMemberIdAndExerciseName(ME, "벤치프레스")).thenReturn(Optional.empty());
        workoutService.addBookmark(ME, "  벤치프레스 ");
        verify(bookmarkRepo).save(argThat(b -> b.getMemberId().equals(ME) && b.getExerciseName().equals("벤치프레스")));

        WorkoutBookmark existing = mock(WorkoutBookmark.class);
        when(bookmarkRepo.findByMemberIdAndExerciseName(ME, "스쿼트")).thenReturn(Optional.of(existing));
        workoutService.addBookmark(ME, "스쿼트");
        verify(bookmarkRepo, times(1)).save(any());
    }

    @Test
    void 즐겨찾기_삭제는_내_것만_조회해서_지운다() {
        workoutService.removeBookmark(ME, "벤치프레스");
        verify(bookmarkRepo).findByMemberIdAndExerciseName(ME, "벤치프레스");
        verify(bookmarkRepo, never()).findByMemberIdAndExerciseName(eq(OTHER), any());
    }

    @Test
    void 빈_종목명은_즐겨찾기할_수_없다() {
        assertThatThrownBy(() -> workoutService.addBookmark(ME, "  ")).isInstanceOf(IllegalArgumentException.class);
        verify(bookmarkRepo, never()).save(any());
    }
}
