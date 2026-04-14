package com.dailo.app.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;

@Getter
@AllArgsConstructor
@Builder
public class DailyStatsDto {
    private LocalDate date;
    private Integer totalAmount;
}
