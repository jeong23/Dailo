package com.dailo.app.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

// R2 미설정 시 사용하는 무료 저장소 — 서버 컴퓨터 폴더에 저장하고 /uploads/** 로 서빙 (UploadResourceConfig)
// 파일명은 UUID라 추측 불가. 서버 컴퓨터를 옮길 때는 이 폴더도 같이 옮겨야 함
@Component
public class LocalImageStorage {

    public static final String URL_PREFIX = "/uploads/";

    private final Path baseDir;

    public LocalImageStorage(@Value("${upload.local-dir:${user.home}/dailo-uploads}") String localDir) {
        this.baseDir = Paths.get(localDir).toAbsolutePath().normalize();
    }

    public Path getBaseDir() {
        return baseDir;
    }

    // key 예: future-vision/uuid.jpg → 반환 URL: /uploads/future-vision/uuid.jpg
    public String save(String folder, byte[] bytes, String ext) throws IOException {
        String key = folder + "/" + UUID.randomUUID() + ext;
        Path target = baseDir.resolve(key).normalize();
        Files.createDirectories(target.getParent());
        Files.write(target, bytes);
        return URL_PREFIX + key;
    }
}
