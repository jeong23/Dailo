package com.dailo.app.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.util.List;

public class PlannerBoardDto {

    @Getter
    @Builder
    public static class Big3Item {
        private String content;
        private boolean isDone;
    }

    @Getter
    @Builder
    public static class DayEntry {
        private LocalDate planDate;
        private boolean hasPlan;
        private int big3Total;
        private int big3Done;
        private int brainDumpTotal;
        private int brainDumpDone;
        private List<Big3Item> big3Items;
    }
}
