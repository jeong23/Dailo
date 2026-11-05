package com.dailo.app.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ImageCleanupServiceTest {

    @TempDir Path dir;

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final R2UploadService r2 = new R2UploadService("", "", "", "", ""); // R2 미설정

    private ImageCleanupService service() {
        return new ImageCleanupService(jdbc, new LocalImageStorage(dir.toString()), r2);
    }

    private Path file(String key) throws Exception {
        Path p = dir.resolve(key);
        Files.createDirectories(p.getParent());
        Files.write(p, new byte[]{1, 2, 3});
        return p;
    }

    private void references(String url, long count) {
        when(jdbc.queryForObject(startsWith("SELECT COUNT(*) FROM vision_board_item"), eq(Long.class), eq(url))).thenReturn(count);
        when(jdbc.queryForObject(startsWith("SELECT COUNT(*) FROM daily_plan"), eq(Long.class), eq(url))).thenReturn(0L);
    }

    @Test
    void 아무도_안_쓰는_로컬_사진은_지운다() throws Exception {
        Path p = file("future-vision/a.jpg");
        references("/uploads/future-vision/a.jpg", 0);
        service().deleteUnreferencedAfterCommit(List.of("/uploads/future-vision/a.jpg"));
        assertThat(p).doesNotExist();
    }

    @Test
    void 다른_곳에서_아직_쓰는_사진은_남긴다() throws Exception {
        // 다른 회원 사진 주소를 자기 보드에 넣고 지워도 원본 파일은 안 지워져야 함
        Path p = file("future-vision/b.jpg");
        references("/uploads/future-vision/b.jpg", 1);
        service().deleteUnreferencedAfterCommit(List.of("/uploads/future-vision/b.jpg"));
        assertThat(p).exists();
    }

    @Test
    void 업로드_폴더_밖_주소는_지우지_않는다() throws Exception {
        Path outside = Files.write(dir.getParent().resolve("dailo-outside-" + System.nanoTime() + ".txt"), new byte[]{1});
        try {
            LocalImageStorage storage = new LocalImageStorage(dir.toString());
            assertThat(storage.delete("/uploads/../" + outside.getFileName())).isFalse();
            assertThat(storage.delete("/uploads/")).isFalse();
            assertThat(outside).exists();
        } finally {
            Files.deleteIfExists(outside);
        }
    }

    @Test
    void 외부_주소와_빈_값은_참조_확인도_안_한다() {
        service().deleteUnreferencedAfterCommit(java.util.Arrays.asList(null, "", "https://example.com/x.jpg"));
        verifyNoInteractions(jdbc);
    }

    @Test
    void R2는_자기_버킷_주소만_자기_것으로_본다() {
        R2UploadService configured = new R2UploadService("acc", "key", "secret", "bucket", "https://img.dailo.test");
        assertThat(configured.owns("https://img.dailo.test/future-vision/a.jpg")).isTrue();
        assertThat(configured.owns("https://img.dailo.test.evil.com/a.jpg")).isFalse();
        assertThat(configured.owns("https://img.dailo.test/")).isFalse();
        assertThat(configured.owns("/uploads/a.jpg")).isFalse();
        assertThat(r2.owns("https://img.dailo.test/a.jpg")).isFalse(); // 미설정
    }
}
