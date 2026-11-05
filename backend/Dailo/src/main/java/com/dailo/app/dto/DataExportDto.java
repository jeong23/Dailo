package com.dailo.app.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

public class DataExportDto {

    // 내보내기 체크 목록 한 줄 — key로 GET /api/export?items=key,key
    @Getter @AllArgsConstructor
    public static class Item {
        private String key;
        private String label;
        private String description;
        private long rows;
    }
}
