package com.dailo.app.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// 이미지 업로드: R2 미설정(빈 값·YOUR_ 예시 값)이면 로컬 폴더에 저장, 형식은 파일 내용으로 판정
class ImageStorageServiceTest {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0};

    @TempDir
    Path dir;

    private R2UploadService r2(String accountId) {
        return new R2UploadService(accountId, "YOUR_ACCESS_KEY", "YOUR_SECRET_KEY", "YOUR_BUCKET_NAME", "https://YOUR_PUBLIC_DOMAIN");
    }

    private ImageStorageService service() {
        return new ImageStorageService(r2("YOUR_ACCOUNT_ID"), new LocalImageStorage(dir.toString()));
    }

    @Test
    void 예시값만_있는_R2는_미설정으로_본다() {
        assertThat(r2("YOUR_ACCOUNT_ID").isConfigured()).isFalse();
        assertThat(r2("").isConfigured()).isFalse();
        assertThat(R2UploadService.isSet("abc123")).isTrue();
    }

    @Test
    void R2_미설정이면_로컬_폴더에_저장하고_uploads_URL을_돌려준다() throws Exception {
        String url = service().store("future-vision", new MockMultipartFile("file", "photo.jpeg", "image/jpeg", JPEG));

        assertThat(url).startsWith("/uploads/future-vision/").endsWith(".jpg");
        Path saved = dir.resolve(url.substring("/uploads/".length()));
        assertThat(Files.readAllBytes(saved)).isEqualTo(JPEG);
    }

    @Test
    void 확장자는_파일명이_아니라_내용으로_정한다() throws Exception {
        // 이름은 .html이어도 실제 PNG면 .png로 저장
        String url = service().store("future-vision", new MockMultipartFile("file", "x.html", "text/html", PNG));
        assertThat(url).endsWith(".png");
    }

    @Test
    void 이미지가_아닌_파일은_거부한다() {
        MockMultipartFile html = new MockMultipartFile("file", "evil.png", "image/png", "<script>alert(1)</script>".getBytes());
        assertThatThrownBy(() -> service().store("future-vision", html))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("JPG, PNG, GIF, WEBP");
    }

    @Test
    void 빈_파일과_10MB_초과는_거부한다() {
        assertThatThrownBy(() -> service().store("future-vision", new MockMultipartFile("file", new byte[0])))
                .isInstanceOf(IllegalArgumentException.class);

        byte[] big = new byte[(int) ImageStorageService.MAX_BYTES + 1];
        System.arraycopy(JPEG, 0, big, 0, JPEG.length);
        assertThatThrownBy(() -> service().store("future-vision", new MockMultipartFile("file", "big.jpg", "image/jpeg", big)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("10MB");
    }
}
