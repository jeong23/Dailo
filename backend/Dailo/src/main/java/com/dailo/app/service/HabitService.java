package com.dailo.app.service;

import com.dailo.app.dto.HabitDto;
import com.dailo.app.entity.Habit;
import com.dailo.app.entity.HabitLog;
import com.dailo.app.repository.HabitLogRepository;
import com.dailo.app.repository.HabitRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HabitService {

    private final HabitRepository habitRepository;
    private final HabitLogRepository habitLogRepository;

    public List<HabitDto.Response> findAll(Long memberId) {
        return habitRepository.findByMemberIdAndIsActiveTrueOrderBySortOrderAsc(memberId)
                .stream()
                .map(HabitDto.Response::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public HabitDto.Response create(Long memberId, HabitDto.Request request) {
        Habit habit = Habit.builder()
                .memberId(memberId)
                .name(request.getName())
                .emoji(request.getEmoji())
                .color(request.getColor())
                .isActive(true)
                .sortOrder(request.getSortOrder() != null ? request.getSortOrder() : 0)
                .habitType(request.getHabitType() != null ? request.getHabitType() : "GOOD")
                .build();
        return HabitDto.Response.from(habitRepository.save(habit));
    }

    @Transactional
    public HabitDto.Response update(Long id, HabitDto.Request request) {
        Habit habit = habitRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("습관을 찾을 수 없습니다: " + id));
        habit.update(
                request.getName(),
                request.getEmoji(),
                request.getColor(),
                request.getHabitType() != null ? request.getHabitType() : "GOOD"
        );
        return HabitDto.Response.from(habit);
    }

    @Transactional
    public void delete(Long id) {
        Habit habit = habitRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("습관을 찾을 수 없습니다: " + id));
        habitLogRepository.deleteByHabitId(id);
        habitRepository.delete(habit);
    }

    public List<HabitDto.LogResponse> findMonthLogs(Long memberId, int year, int month) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
        return habitLogRepository.findByHabitMemberIdAndLogDateBetween(memberId, start, end)
                .stream()
                .map(HabitDto.LogResponse::from)
                .collect(Collectors.toList());
    }

    // 월간 그리드용 토글 (0 → 1, 1+ → 0)
    @Transactional
    public void toggleLog(Long habitId, LocalDate logDate) {
        habitLogRepository.findByHabitIdAndLogDate(habitId, logDate)
                .ifPresentOrElse(
                        habitLogRepository::delete,
                        () -> {
                            Habit habit = habitRepository.findById(habitId)
                                    .orElseThrow(() -> new IllegalArgumentException("습관을 찾을 수 없습니다: " + habitId));
                            habitLogRepository.save(HabitLog.builder()
                                    .habit(habit)
                                    .logDate(logDate)
                                    .count(1)
                                    .build());
                        }
                );
    }

    // 오늘 카운트 +1
    @Transactional
    public void incrementLog(Long habitId, LocalDate logDate) {
        habitLogRepository.findByHabitIdAndLogDate(habitId, logDate)
                .ifPresentOrElse(
                        log -> { log.increment(); habitLogRepository.save(log); },
                        () -> {
                            Habit habit = habitRepository.findById(habitId)
                                    .orElseThrow(() -> new IllegalArgumentException("습관을 찾을 수 없습니다: " + habitId));
                            habitLogRepository.save(HabitLog.builder()
                                    .habit(habit)
                                    .logDate(logDate)
                                    .count(1)
                                    .build());
                        }
                );
    }

    // 오늘 카운트 -1 (0이면 삭제)
    @Transactional
    public void decrementLog(Long habitId, LocalDate logDate) {
        habitLogRepository.findByHabitIdAndLogDate(habitId, logDate)
                .ifPresent(log -> {
                    if (log.getCount() <= 1) {
                        habitLogRepository.delete(log);
                    } else {
                        log.decrement();
                        habitLogRepository.save(log);
                    }
                });
    }
}