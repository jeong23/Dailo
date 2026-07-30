package com.dailo.app.dto;

import com.dailo.app.entity.WorkoutRoutine;
import com.dailo.app.entity.WorkoutRoutineExercise;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

public class WorkoutRoutineDto {

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ExerciseRequest {
        private Long id;       // null = 신규
        private String exerciseName;
        private Integer targetSets;
        private Integer sortOrder;
    }

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoutineRequest {
        private Long id;       // null = 신규
        private String name;
        private Integer sortOrder;
        private List<ExerciseRequest> exercises;
    }

    @Getter
    @Builder
    public static class ExerciseResponse {
        private Long id;
        private String exerciseName;
        private Integer targetSets;
        private Integer sortOrder;

        public static ExerciseResponse from(WorkoutRoutineExercise exercise) {
            return ExerciseResponse.builder()
                    .id(exercise.getId())
                    .exerciseName(exercise.getExerciseName())
                    .targetSets(exercise.getTargetSets())
                    .sortOrder(exercise.getSortOrder())
                    .build();
        }
    }

    @Getter
    @Builder
    public static class RoutineResponse {
        private Long id;
        private String name;
        private Integer sortOrder;
        private List<ExerciseResponse> exercises;

        public static RoutineResponse from(WorkoutRoutine routine, List<WorkoutRoutineExercise> exercises) {
            return RoutineResponse.builder()
                    .id(routine.getId())
                    .name(routine.getName())
                    .sortOrder(routine.getSortOrder())
                    .exercises(exercises.stream().map(ExerciseResponse::from).toList())
                    .build();
        }
    }
}
