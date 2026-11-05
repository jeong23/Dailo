package com.dailo.app.service;

import com.dailo.app.dto.VisionBoardDto;
import com.dailo.app.entity.VisionBoardItem;
import com.dailo.app.repository.VisionBoardItemRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

// 미래 시각화 보드: 내 사진만 옮기기·삭제, 보드 밖으로 못 나감, 업로드 주소만 허용
class VisionBoardServiceTest {

    private static final Long ME = 1L;
    private static final Long OTHER = 2L;

    private final VisionBoardItemRepository repo = mock(VisionBoardItemRepository.class);
    private final VisionBoardService service = new VisionBoardService(repo, mock(ImageCleanupService.class));

    private VisionBoardItem item(Long memberId) {
        return VisionBoardItem.builder().memberId(memberId).imageUrl("/uploads/future-vision/a.jpg")
                .x(10d).y(10d).w(30d).h(30d).z(1).build();
    }

    @Test
    void 다른_회원의_사진은_옮기거나_지울_수_없다() {
        VisionBoardItem other = item(OTHER);
        when(repo.findById(5L)).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.update(ME, 5L, new VisionBoardDto.Request(null, 0d, 0d, 50d, 50d, 9)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.delete(ME, 5L)).isInstanceOf(IllegalArgumentException.class);
        assertThat(other.getX()).isEqualTo(10d);
        verify(repo, never()).delete(any());
    }

    @Test
    void 보드_밖으로_나가거나_너무_작아지지_않게_맞춘다() {
        VisionBoardItem mine = item(ME);
        when(repo.findById(5L)).thenReturn(Optional.of(mine));

        service.update(ME, 5L, new VisionBoardDto.Request(null, 90d, -20d, 40d, 1d, -3));

        assertThat(mine.getW()).isEqualTo(40d);
        assertThat(mine.getX()).isEqualTo(60d); // 100 - w
        assertThat(mine.getY()).isEqualTo(0d);
        assertThat(mine.getH()).isEqualTo(VisionBoardService.MIN_SIZE);
        assertThat(mine.getZ()).isEqualTo(0);
    }

    @Test
    void 업로드_주소가_아니면_거부하고_20장까지만_올린다() {
        assertThatThrownBy(() -> service.create(ME, new VisionBoardDto.Request("javascript:alert(1)", 0d, 0d, 30d, 30d, 0)))
                .hasMessageContaining("이미지 주소");

        when(repo.countByMemberId(ME)).thenReturn((long) VisionBoardService.MAX_ITEMS);
        assertThatThrownBy(() -> service.create(ME, new VisionBoardDto.Request("/uploads/future-vision/b.jpg", 0d, 0d, 30d, 30d, 0)))
                .hasMessageContaining("20장");
        verify(repo, never()).save(any());
    }

    @Test
    void 새_사진은_로그인_회원_것으로_저장된다() {
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        VisionBoardDto.Response res = service.create(ME, new VisionBoardDto.Request("/uploads/future-vision/b.jpg", 5d, 5d, 30d, 20d, 2));
        verify(repo).save(argThat(i -> i.getMemberId().equals(ME)));
        assertThat(res.getW()).isEqualTo(30d);
    }
}
