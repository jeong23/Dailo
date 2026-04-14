package com.dailo.app.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;

public class PlannerBoardDto {

    @Getter
    @Builder
    public static class DayEntry {
        private LocalDate planDate;
        private boolean hasPlan;
        private int big3Total;
        private int big3Done;
        private int brainDumpTotal;
        private int brainDumpDone;
    }
}
