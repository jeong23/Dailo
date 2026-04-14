package com.dailo.app.dto;

import com.dailo.app.entity.Category;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CategoryRequestDto {

    private String name;
    private String icon;
    private Integer sortOrder;

    public Category toEntity() {
        return Category.builder()
                .name(name)
                .icon(icon)
                .sortOrder(sortOrder)
                .build();
    }
}