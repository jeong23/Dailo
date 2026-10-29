package com.dailo.app.config;

import com.dailo.app.service.LocalImageStorage;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

// 로컬 저장 이미지 서빙: /uploads/** → 서버 컴퓨터 업로드 폴더
// <img> 태그는 JWT 헤더를 못 보내므로 인증 없이 열림 (SecurityConfig anyRequest().permitAll()) — 파일명이 UUID라 목록 노출 없음
@Configuration
@RequiredArgsConstructor
public class UploadResourceConfig implements WebMvcConfigurer {

    private final LocalImageStorage localImageStorage;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler(LocalImageStorage.URL_PREFIX + "**")
                .addResourceLocations(localImageStorage.getBaseDir().toUri().toString())
                .setCachePeriod(60 * 60 * 24 * 365); // UUID 파일명은 내용이 바뀌지 않음
    }
}
