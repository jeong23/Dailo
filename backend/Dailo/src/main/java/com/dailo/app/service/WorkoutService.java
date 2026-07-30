package com.dailo.app.service;

import com.dailo.app.dto.WorkoutLogDto;
import com.dailo.app.dto.WorkoutRoutineDto;
import com.dailo.app.entity.WorkoutLog;
import com.dailo.app.entity.WorkoutRoutine;
import com.dailo.app.entity.WorkoutRoutineExercise;
import com.dailo.app.entity.WorkoutSet;
import com.dailo.app.repository.WorkoutLogRepository;
import com.dailo.app.repository.WorkoutRoutineExerciseRepository;
import com.dailo.app.repository.WorkoutRoutineRepository;
import com.dailo.app.repository.WorkoutSetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkoutService {

    private final WorkoutRoutineRepository routineRepository;
    private final WorkoutRoutineExerciseRepository routineExerciseRepository;
    private final WorkoutLogRepository logRepository;
    private final WorkoutSetRepository setRepository;

    // ── Routine ───────────────────────────

    public List<WorkoutRoutineDto.RoutineResponse> findRoutines(Long memberId) {
        List<WorkoutRoutine> routines = routineRepository.findByMemberIdOrderBySortOrderAsc(memberId);
        return buildRoutineResponses(routines);
    }

    private List<WorkoutRoutineDto.RoutineResponse> buildRoutineResponses(List<WorkoutRoutine> routines) {
        List<Long> routineIds = routines.stream().map(WorkoutRoutine::getId).collect(Collectors.toList());
        Map<Long, List<WorkoutRoutineExercise>> exercisesByRoutine =
                routineExerciseRepository.findByRoutineIdInOrderBySortOrderAsc(routineIds).stream()
                        .collect(Collectors.groupingBy(e -> e.getRoutine().getId()));

        return routines.stream()
                .map(r -> WorkoutRoutineDto.RoutineResponse.from(
                        r, exercisesByRoutine.getOrDefault(r.getId(), List.of())))
                .collect(Collectors.toList());
    }

    @Transactional
    public List<WorkoutRoutineDto.RoutineResponse> saveRoutines(
            Long memberId, List<WorkoutRoutineDto.RoutineRequest> routineReqs) {

        Set<Long> keptRoutineIds = new HashSet<>();
        Set<Long> keptExerciseIds = new HashSet<>();

        for (WorkoutRoutineDto.RoutineRequest rr : routineReqs) {
            WorkoutRoutine routine;
            if (rr.getId() != null) {
                routine = routineRepository.findById(rr.getId())
                        .orElseThrow(() -> new IllegalArgumentException("루틴을 찾을 수 없습니다: " + rr.getId()));
                routine.update(rr.getName(), rr.getSortOrder());
            } else {
                routine = routineRepository.save(WorkoutRoutine.builder()
                        .memberId(memberId)
                        .name(rr.getName())
                        .sortOrder(rr.getSortOrder())
                        .build());
            }
            keptRoutineIds.add(routine.getId());

            if (rr.getExercises() != null) {
                for (WorkoutRoutineDto.ExerciseRequest er : rr.getExercises()) {
                    WorkoutRoutineExercise exercise;
                    if (er.getId() != null) {
                        exercise = routineExerciseRepository.findById(er.getId())
                                .orElseThrow(() -> new IllegalArgumentException("종목을 찾을 수 없습니다: " + er.getId()));
                        exercise.update(er.getExerciseName(), er.getTargetSets(), er.getSortOrder());
                    } else {
                        exercise = routineExerciseRepository.save(WorkoutRoutineExercise.builder()
                                .routine(routine)
                                .exerciseName(er.getExerciseName())
                                .targetSets(er.getTargetSets())
                                .sortOrder(er.getSortOrder())
                                .build());
                    }
                    keptExerciseIds.add(exercise.getId());
                }
            }
        }

        // 요청에 없는 기존 루틴/종목 삭제
        List<WorkoutRoutine> existingRoutines = routineRepository.findByMemberIdOrderBySortOrderAsc(memberId);
        for (WorkoutRoutine routine : existingRoutines) {
            if (!keptRoutineIds.contains(routine.getId())) {
                routineExerciseRepository.deleteByRoutineId(routine.getId());
                routineRepository.delete(routine);
            } else {
                List<WorkoutRoutineExercise> exercises =
                        routineExerciseRepository.findByRoutineIdOrderBySortOrderAsc(routine.getId());
                for (WorkoutRoutineExercise exercise : exercises) {
                    if (!keptExerciseIds.contains(exercise.getId())) {
                        routineExerciseRepository.delete(exercise);
                    }
                }
            }
        }

        return findRoutines(memberId);
    }

    // ── Log ───────────────────────────────

    public List<WorkoutLogDto.LogResponse> findLogs(Long memberId, int year, int month) {
        LocalDate from = LocalDate.of(year, month, 1);
        LocalDate to = from.withDayOfMonth(from.lengthOfMonth());
        List<WorkoutLog> logs =
                logRepository.findByMemberIdAndWorkoutDateBetweenOrderByWorkoutDateAsc(memberId, from, to);

        List<Long> logIds = logs.stream().map(WorkoutLog::getId).collect(Collectors.toList());
        Map<Long, List<WorkoutSet>> setsByLog =
                setRepository.findByWorkoutLogIdInOrderByExerciseSortOrderAscSetNumberAsc(logIds).stream()
                        .collect(Collectors.groupingBy(s -> s.getWorkoutLog().getId()));

        return logs.stream()
                .map(l -> WorkoutLogDto.LogResponse.from(l, setsByLog.getOrDefault(l.getId(), List.of())))
                .collect(Collectors.toList());
    }

    @Transactional
    public WorkoutLogDto.LogResponse saveLog(Long memberId, WorkoutLogDto.LogRequest req) {
        WorkoutLog log = logRepository.findByMemberIdAndWorkoutDate(memberId, req.getWorkoutDate())
                .orElse(null);

        if (log == null) {
            log = logRepository.save(WorkoutLog.builder()
                    .memberId(memberId)
                    .routineId(req.getRoutineId())
                    .workoutDate(req.getWorkoutDate())
                    .memo(req.getMemo())
                    .build());
        } else {
            log.update(req.getRoutineId(), req.getMemo());
        }

        Set<Long> keptSetIds = new HashSet<>();
        if (req.getSets() != null) {
            for (WorkoutLogDto.SetRequest sr : req.getSets()) {
                WorkoutSet set;
                if (sr.getId() != null) {
                    set = setRepository.findById(sr.getId())
                            .orElseThrow(() -> new IllegalArgumentException("세트를 찾을 수 없습니다: " + sr.getId()));
                    set.update(sr.getExerciseName(), sr.getExerciseSortOrder(), sr.getSetNumber(),
                            sr.getWeightKg(), sr.getReps(), sr.getIsDone());
                } else {
                    WorkoutLog finalLog = log;
                    set = setRepository.save(WorkoutSet.builder()
                            .workoutLog(finalLog)
                            .exerciseName(sr.getExerciseName())
                            .exerciseSortOrder(sr.getExerciseSortOrder())
                            .setNumber(sr.getSetNumber())
                            .weightKg(sr.getWeightKg())
                            .reps(sr.getReps())
                            .isDone(sr.getIsDone() != null ? sr.getIsDone() : Boolean.FALSE)
                            .build());
                }
                keptSetIds.add(set.getId());
            }
        }

        // 요청에 없는 기존 세트 삭제
        List<WorkoutSet> existingSets =
                setRepository.findByWorkoutLogIdOrderByExerciseSortOrderAscSetNumberAsc(log.getId());
        for (WorkoutSet set : existingSets) {
            if (!keptSetIds.contains(set.getId())) {
                setRepository.delete(set);
            }
        }

        List<WorkoutSet> finalSets =
                setRepository.findByWorkoutLogIdOrderByExerciseSortOrderAscSetNumberAsc(log.getId());
        return WorkoutLogDto.LogResponse.from(log, finalSets);
    }

    @Transactional
    public void deleteLog(Long id) {
        WorkoutLog log = logRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("운동 기록을 찾을 수 없습니다: " + id));
        setRepository.deleteByWorkoutLogId(id);
        logRepository.delete(log);
    }

    // ── 종목명 자동완성 ─────────────────────

    public List<String> findExerciseNames(Long memberId, String query) {
        List<String> frequent = setRepository.findFrequentExerciseNames(memberId, PageRequest.of(0, 50));
        if (query == null || query.isBlank()) {
            return frequent.stream().distinct().limit(10).collect(Collectors.toList());
        }
        String lower = query.toLowerCase();
        return frequent.stream()
                .distinct()
                .filter(name -> name.toLowerCase().contains(lower))
                .limit(10)
                .collect(Collectors.toList());
    }
}
