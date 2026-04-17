package com.dailo.app.dto;

import com.dailo.app.entity.RunningGoal;
import com.dailo.app.entity.RunningRecord;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

public class RunningDto {

    // ── Goal ──────────────────────────────

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GoalRequest {
        private Integer year;
        private Integer month;
        private Integer targetCount;
        private Double targetDistanceKm;
    }

    @Getter
    @Builder
    public static class GoalResponse {
        private Long id;
        private Integer year;
        private Integer month;
        private Integer targetCount;
        private Double targetDistanceKm;
        // 달성 현황
        private Integer achievedCount;
        private Double achievedDistanceKm;
        private Integer streak;

        public static GoalResponse of(RunningGoal goal, int achievedCount, double achievedDistanceKm, int streak) {
            return GoalResponse.builder()
                    .id(goal.getId())
                    .year(goal.getYear())
                    .month(goal.getMonth())
                    .targetCount(goal.getTargetCount())
                    .targetDistanceKm(goal.getTargetDistanceKm())
                    .achievedCount(achievedCount)
                    .achievedDistanceKm(achievedDistanceKm)
                    .streak(streak)
                    .build();
        }
    }

    // ── Record ────────────────────────────

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecordRequest {
        private LocalDate runDate;
        private Boolean ran;
        private String title;
        private Double distanceKm;
        private Integer durationSeconds;
        private Integer calories;
        private Integer elevationGain;
        private Integer avgHeartRate;
        private Integer cadence;
        private String memo;
        private String routeJson;
    }

    @Getter
    @Builder
    public static class RecordResponse {
        private Long id;
        private LocalDate runDate;
        private Boolean ran;
        private String title;
        private Double distanceKm;
        private Integer durationSeconds;
        private String pace; // "7'05''" 형식
        private Integer calories;
        private Integer elevationGain;
        private Integer avgHeartRate;
        private Integer cadence;
        private String memo;
        private String routeJson;

        public static RecordResponse from(RunningRecord r) {
            return RecordResponse.builder()
                    .id(r.getId())
                    .runDate(r.getRunDate())
                    .ran(r.getRan())
                    .title(r.getTitle())
                    .distanceKm(r.getDistanceKm())
                    .durationSeconds(r.getDurationSeconds())
                    .pace(calcPace(r.getDurationSeconds(), r.getDistanceKm()))
                    .calories(r.getCalories())
                    .elevationGain(r.getElevationGain())
                    .avgHeartRate(r.getAvgHeartRate())
                    .cadence(r.getCadence())
                    .memo(r.getMemo())
                    .routeJson(r.getRouteJson())
                    .build();
        }

        private static String calcPace(Integer durationSeconds, Double distanceKm) {
            if (durationSeconds == null || distanceKm == null || distanceKm == 0) return null;
            double paceSeconds = durationSeconds / distanceKm;
            int min = (int) (paceSeconds / 60);
            int sec = (int) (paceSeconds % 60);
            return String.format("%d'%02d''", min, sec);
        }
    }
}
