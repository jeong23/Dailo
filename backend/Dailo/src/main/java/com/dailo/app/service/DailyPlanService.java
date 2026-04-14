package com.dailo.app.service;

import com.dailo.app.dto.DailyPlanDto;
import com.dailo.app.dto.PlannerBoardDto;
import com.dailo.app.entity.DailyPlan;
import com.dailo.app.entity.TodoItem;
import com.dailo.app.repository.DailyPlanRepository;
import com.dailo.app.repository.TodoItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DailyPlanService {

    private final DailyPlanRepository dailyPlanRepository;
    private final TodoItemRepository todoItemRepository;

    public List<PlannerBoardDto.DayEntry> findMonthlyBoard(int year, int month) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.withDayOfMonth(start.lengthOfMonth());

        Set<LocalDate> planDates = dailyPlanRepository.findByPlanDateBetweenOrderByPlanDateAsc(start, end)
                .stream().map(DailyPlan::getPlanDate).collect(Collectors.toSet());

        List<TodoItem> big3Items = todoItemRepository.findByPlanDateBetweenAndType(start, end, "BIG3");
        List<TodoItem> brainItems = todoItemRepository.findByPlanDateBetweenAndType(start, end, "BRAIN_DUMP");

        Map<LocalDate, List<TodoItem>> big3ByDate = big3Items.stream()
                .collect(Collectors.groupingBy(TodoItem::getPlanDate));
        Map<LocalDate, List<TodoItem>> brainByDate = brainItems.stream()
                .collect(Collectors.groupingBy(TodoItem::getPlanDate));

        Set<LocalDate> allDates = new HashSet<>();
        allDates.addAll(planDates);
        allDates.addAll(big3ByDate.keySet());
        allDates.addAll(brainByDate.keySet());

        return allDates.stream().sorted().map(date -> {
            List<TodoItem> big3 = big3ByDate.getOrDefault(date, Collections.emptyList());
            List<TodoItem> brain = brainByDate.getOrDefault(date, Collections.emptyList());
            return PlannerBoardDto.DayEntry.builder()
                    .planDate(date)
                    .hasPlan(planDates.contains(date))
                    .big3Total(big3.size())
                    .big3Done((int) big3.stream().filter(i -> Boolean.TRUE.equals(i.getIsDone())).count())
                    .brainDumpTotal(brain.size())
                    .brainDumpDone((int) brain.stream().filter(i -> Boolean.TRUE.equals(i.getIsDone())).count())
                    .build();
        }).collect(Collectors.toList());
    }

    public DailyPlanDto.Response findByDate(LocalDate date) {
        return dailyPlanRepository.findByPlanDate(date)
                .map(DailyPlanDto.Response::from)
                .orElse(null);
    }

    @Transactional
    public DailyPlanDto.Response upsert(DailyPlanDto.Request request) {
        Optional<DailyPlan> existing = dailyPlanRepository.findByPlanDate(request.getPlanDate());

        if (existing.isPresent()) {
            DailyPlan plan = existing.get();
            plan.update(
                    request.getFutureVisionUrl(),
                    request.getIdentity1(), request.getIdentity2(), request.getIdentity3(),
                    request.getMotivation1(), request.getMotivation2(), request.getMotivation3(),
                    request.getGratitude1(), request.getGratitude2(), request.getGratitude3(),
                    request.getFirstTask(),
                    request.getFeedbackStart(), request.getFeedbackMid(), request.getFeedbackEnd()
            );
            return DailyPlanDto.Response.from(plan);
        }

        DailyPlan plan = DailyPlan.builder()
                .planDate(request.getPlanDate())
                .futureVisionUrl(request.getFutureVisionUrl())
                .identity1(request.getIdentity1())
                .identity2(request.getIdentity2())
                .identity3(request.getIdentity3())
                .motivation1(request.getMotivation1())
                .motivation2(request.getMotivation2())
                .motivation3(request.getMotivation3())
                .gratitude1(request.getGratitude1())
                .gratitude2(request.getGratitude2())
                .gratitude3(request.getGratitude3())
                .firstTask(request.getFirstTask())
                .feedbackStart(request.getFeedbackStart())
                .feedbackMid(request.getFeedbackMid())
                .feedbackEnd(request.getFeedbackEnd())
                .build();

        return DailyPlanDto.Response.from(dailyPlanRepository.save(plan));
    }
}
