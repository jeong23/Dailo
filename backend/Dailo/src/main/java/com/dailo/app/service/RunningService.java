package com.dailo.app.service;

import com.dailo.app.dto.RunningDto;
import com.dailo.app.entity.RunningGoal;
import com.dailo.app.entity.RunningRecord;
import com.dailo.app.repository.RunningGoalRepository;
import com.dailo.app.repository.RunningRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RunningService {

    private final RunningGoalRepository goalRepository;
    private final RunningRecordRepository recordRepository;

    // ── Goal ──────────────────────────────

    @Transactional
    public RunningDto.GoalResponse saveGoal(RunningDto.GoalRequest req) {
        RunningGoal goal = goalRepository.findByYearAndMonth(req.getYear(), req.getMonth())
                .orElse(null);

        if (goal == null) {
            goal = goalRepository.save(RunningGoal.builder()
                    .year(req.getYear())
                    .month(req.getMonth())
                    .targetCount(req.getTargetCount())
                    .targetDistanceKm(req.getTargetDistanceKm())
                    .build());
        } else {
            goal.update(req.getTargetCount(), req.getTargetDistanceKm());
        }

        return buildGoalResponse(goal);
    }

    public RunningDto.GoalResponse getGoal(int year, int month) {
        return goalRepository.findByYearAndMonth(year, month)
                .map(this::buildGoalResponse)
                .orElse(null);
    }

    private RunningDto.GoalResponse buildGoalResponse(RunningGoal goal) {
        LocalDate from = LocalDate.of(goal.getYear(), goal.getMonth(), 1);
        LocalDate to = from.withDayOfMonth(from.lengthOfMonth());
        List<RunningRecord> records = recordRepository.findByRunDateBetweenOrderByRunDateAsc(from, to);

        int achievedCount = (int) records.stream().filter(r -> Boolean.TRUE.equals(r.getRan())).count();
        double achievedDistance = records.stream()
                .filter(r -> Boolean.TRUE.equals(r.getRan()) && r.getDistanceKm() != null)
                .mapToDouble(RunningRecord::getDistanceKm).sum();

        // 연속 달성 스트릭 (오늘 기준 역순)
        int streak = calcStreak();

        return RunningDto.GoalResponse.of(goal, achievedCount, Math.round(achievedDistance * 10.0) / 10.0, streak);
    }

    private int calcStreak() {
        LocalDate date = LocalDate.now();
        int streak = 0;
        while (true) {
            RunningRecord r = recordRepository.findByRunDate(date).orElse(null);
            if (r != null && Boolean.TRUE.equals(r.getRan())) {
                streak++;
                date = date.minusDays(1);
            } else {
                break;
            }
        }
        return streak;
    }

    // ── Record ────────────────────────────

    @Transactional
    public RunningDto.RecordResponse saveRecord(RunningDto.RecordRequest req) {
        RunningRecord record = recordRepository.findByRunDate(req.getRunDate()).orElse(null);

        if (record == null) {
            record = recordRepository.save(RunningRecord.builder()
                    .runDate(req.getRunDate())
                    .ran(req.getRan())
                    .title(req.getTitle())
                    .distanceKm(req.getDistanceKm())
                    .durationSeconds(req.getDurationSeconds())
                    .calories(req.getCalories())
                    .elevationGain(req.getElevationGain())
                    .avgHeartRate(req.getAvgHeartRate())
                    .cadence(req.getCadence())
                    .memo(req.getMemo())
                    .routeJson(req.getRouteJson())
                    .build());
        } else {
            record.update(req.getRan(), req.getTitle(), req.getDistanceKm(), req.getDurationSeconds(),
                    req.getCalories(), req.getElevationGain(), req.getAvgHeartRate(),
                    req.getCadence(), req.getMemo(), req.getRouteJson());
        }

        return RunningDto.RecordResponse.from(record);
    }

    public RunningDto.RecordResponse getRecord(LocalDate date) {
        return recordRepository.findByRunDate(date)
                .map(RunningDto.RecordResponse::from)
                .orElse(null);
    }

    public List<RunningDto.RecordResponse> getMonthRecords(int year, int month) {
        LocalDate from = LocalDate.of(year, month, 1);
        LocalDate to = from.withDayOfMonth(from.lengthOfMonth());
        return recordRepository.findByRunDateBetweenOrderByRunDateAsc(from, to)
                .stream().map(RunningDto.RecordResponse::from).collect(Collectors.toList());
    }

    public List<RunningDto.RecordResponse> getYearRecords(int year) {
        LocalDate from = LocalDate.of(year, 1, 1);
        LocalDate to = LocalDate.of(year, 12, 31);
        return recordRepository.findByRunDateBetweenOrderByRunDateAsc(from,to)
                .stream().map(RunningDto.RecordResponse::from).collect(Collectors.toList());
    }
}
