package com.dailo.app.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

// 이미지 업로드 진입점 — 검증 후 저장소 선택
// R2 설정이 있으면 R2, 없으면(빈 값·YOUR_ 예시 값) 서버 컴퓨터 폴더. 런칭 시 application.yml에 R2 키만 넣으면 전환됨
@Service
@RequiredArgsConstructor
public class ImageStorageService {

    static final long MAX_BYTES = 10L * 1024 * 1024;

    private final R2UploadService r2UploadService;
    private final LocalImageStorage localImageStorage;

    public String store(String folder, MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("이미지 파일을 선택해주세요");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("이미지는 10MB 이하만 올릴 수 있습니다");
        }
        byte[] bytes = file.getBytes();
        // 확장자·Content-Type은 클라이언트가 조작할 수 있어 파일 앞부분(매직 넘버)으로 형식 판정
        // → .html 등을 이미지로 위장해 올려도 저장되지 않음
        ImageType type = ImageType.detect(bytes);
        if (type == null) {
            throw new IllegalArgumentException("JPG, PNG, GIF, WEBP 이미지만 올릴 수 있습니다");
        }
        if (r2UploadService.isConfigured()) {
            return r2UploadService.upload(folder, bytes, type.ext, type.contentType);
        }
        return localImageStorage.save(folder, bytes, type.ext);
    }

    enum ImageType {
        JPEG(".jpg", "image/jpeg"), PNG(".png", "image/png"), GIF(".gif", "image/gif"), WEBP(".webp", "image/webp");

        final String ext;
        final String contentType;

        ImageType(String ext, String contentType) {
            this.ext = ext;
            this.contentType = contentType;
        }

        static ImageType detect(byte[] b) {
            if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) return JPEG;
            if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return PNG;
            if (b.length >= 6 && b[0] == 'G' && b[1] == 'I' && b[2] == 'F' && b[3] == '8') return GIF;
            if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                    && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return WEBP;
            return null;
        }
    }
}
