package com.dailo.app.service;

import com.dailo.app.dto.InvestDto;
import com.dailo.app.entity.InvestTheme;
import com.dailo.app.repository.AssetBucketRepository;
import com.dailo.app.repository.InvestHoldingRepository;
import com.dailo.app.repository.InvestThemeRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AllocationServiceTest {

    private final InvestThemeRepository themeRepo = mock(InvestThemeRepository.class);
    private final InvestHoldingRepository holdingRepo = mock(InvestHoldingRepository.class);
    private final AssetBucketRepository bucketRepo = mock(AssetBucketRepository.class);
    private final AllocationService service = new AllocationService(themeRepo, holdingRepo, bucketRepo);

    @Test
    void 비중_합계가_100이_아니면_거절() {
        assertThatThrownBy(() -> AllocationService.validatePercent(List.of(30f, 30f), "테마"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatCode(() -> AllocationService.validatePercent(List.of(33.3f, 33.3f, 33.4f), "테마")).doesNotThrowAnyException();
        assertThatCode(() -> AllocationService.validatePercent(List.of(), "테마")).doesNotThrowAnyException();
    }

    @Test
    void 다른_회원의_테마는_수정할_수_없다() {
        InvestTheme other = mock(InvestTheme.class);
        when(other.getMemberId()).thenReturn(2L);
        when(themeRepo.findById(9L)).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.saveThemes(1L, List.of(new InvestDto.ThemeDto(9L, "AI", 100f, false, 0))))
                .isInstanceOf(IllegalArgumentException.class);
        verify(other, never()).update(any(), any(), any(), any());
    }

    @Test
    void 다른_회원의_자산칸은_수정할_수_없다() {
        com.dailo.app.entity.AssetBucket other = mock(com.dailo.app.entity.AssetBucket.class);
        when(other.getMemberId()).thenReturn(2L);
        when(bucketRepo.findById(5L)).thenReturn(Optional.of(other));

        assertThatThrownBy(() -> service.saveBuckets(1L, List.of(new InvestDto.BucketDto(5L, "현금", "CASH", 100f, null, 0))))
                .isInstanceOf(IllegalArgumentException.class);
        verify(other, never()).update(any(), any(), any(), any(), any());
    }
}
