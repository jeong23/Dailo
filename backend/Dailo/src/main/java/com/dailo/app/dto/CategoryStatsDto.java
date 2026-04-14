package com.dailo.app.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class CategoryStatsDto {
    private Long categoryId;
    private String categoryName;
    private String icon;
    private Integer totalAmount;
}
