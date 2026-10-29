package com.dailo.app.dto;

import com.dailo.app.entity.WorkoutLog;
import com.dailo.app.entity.WorkoutSet;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

public class WorkoutLogDto {

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SetRequest {
        private Long id;       // null = 신규
        private String exerciseName;
        private Integer exerciseSortOrder;
        private Integer setNumber;
        private Float weightKg;
        private Integer reps;
        private Boolean isDone;
        private String setType;  // NORMAL / WARMUP / DROP / FAILURE
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LogRequest {
        private Long routineId;
        private LocalDate workoutDate;
        private String memo;
        private List<SetRequest> sets;
    }

    @Getter
    @Builder
    public static class SetResponse {
        private Long id;
        private String exerciseName;
        private Integer exerciseSortOrder;
        private Integer setNumber;
        private Float weightKg;
        private Integer reps;
        private Boolean isDone;
        private String setType;

        public static SetResponse from(WorkoutSet set) {
            return SetResponse.builder()
                    .id(set.getId())
                    .exerciseName(set.getExerciseName())
                    .exerciseSortOrder(set.getExerciseSortOrder())
                    .setNumber(set.getSetNumber())
                    .weightKg(set.getWeightKg())
                    .reps(set.getReps())
                    .isDone(set.getIsDone())
                    .setType(set.getSetType() != null ? set.getSetType() : "NORMAL")
                    .build();
        }
    }

    @Getter
    @Builder
    public static class LogResponse {
        private Long id;
        private Long routineId;
        private LocalDate workoutDate;
        private String memo;
        private List<SetResponse> sets;

        public static LogResponse from(WorkoutLog log, List<WorkoutSet> sets) {
            return LogResponse.builder()
                    .id(log.getId())
                    .routineId(log.getRoutineId())
                    .workoutDate(log.getWorkoutDate())
                    .memo(log.getMemo())
                    .sets(sets.stream().map(SetResponse::from).toList())
                    .build();
        }
    }
}
