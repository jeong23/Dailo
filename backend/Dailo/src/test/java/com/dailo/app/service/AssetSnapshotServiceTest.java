package com.dailo.app.service;

import com.dailo.app.dto.AssetSnapshotDto;
import com.dailo.app.entity.AssetSnapshot;
import com.dailo.app.entity.Member;
import com.dailo.app.repository.AssetSnapshotRepository;
import com.dailo.app.repository.MemberRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AssetSnapshotServiceTest {

    private final AssetSnapshotRepository repo = mock(AssetSnapshotRepository.class);
    private final MemberRepository members = mock(MemberRepository.class);
    private final AssetSnapshotService service = new AssetSnapshotService(repo, members);

    private void at(String kstDateTime) {
        service.clock = Clock.fixed(ZonedDateTime.parse(kstDateTime + "+09:00[Asia/Seoul]").toInstant(), AssetSnapshotService.KST);
    }

    private void salaryDay(Integer day) {
        Member m = mock(Member.class);
        when(m.getSalaryDay()).thenReturn(day);
        when(members.findById(7L)).thenReturn(Optional.of(m));
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    private AssetSnapshotDto.Request req(long cash, long invest, long savings, long manual) {
        return new AssetSnapshotDto.Request(cash, invest, savings, manual);
    }

    @Test
    void 월급일_전이면_이번_달_정산월() {
        salaryDay(25);
        at("2026-11-24T23:59:00");
        when(repo.findByMemberIdAndSettleMonth(7L, "2026-11")).thenReturn(Optional.empty());

        AssetSnapshotDto.Response r = service.recordCurrent(7L, req(100, 200, 300, 400));

        assertThat(r.getSettleMonth()).isEqualTo("2026-11");
        assertThat(r.getTotal()).isEqualTo(1000);
    }

    @Test
    void 월급일부터는_다음_달_정산월_KST_기준() {
        salaryDay(25);
        at("2026-11-25T08:00:00"); // UTC로는 24일 23시 — KST로 판정해야 다음 달
        when(repo.findByMemberIdAndSettleMonth(eq(7L), anyString())).thenReturn(Optional.empty());

        assertThat(service.recordCurrent(7L, req(1, 0, 0, 0)).getSettleMonth()).isEqualTo("2026-12");
    }

    @Test
    void 월급일이_없으면_25일_기준() {
        salaryDay(null);
        at("2026-12-26T10:00:00");
        when(repo.findByMemberIdAndSettleMonth(eq(7L), anyString())).thenReturn(Optional.empty());

        assertThat(service.recordCurrent(7L, req(1, 0, 0, 0)).getSettleMonth()).isEqualTo("2027-01");
    }

    @Test
    void 같은_달은_새_줄_대신_덮어쓴다() {
        salaryDay(25);
        at("2026-11-10T12:00:00");
        AssetSnapshot existing = AssetSnapshot.builder().memberId(7L).settleMonth("2026-11")
                .cash(1L).invest(1L).savings(1L).manual(1L).capturedAt(java.time.LocalDateTime.of(2026, 11, 1, 0, 0)).build();
        when(repo.findByMemberIdAndSettleMonth(7L, "2026-11")).thenReturn(Optional.of(existing));

        service.recordCurrent(7L, req(5, 6, 7, 8));

        ArgumentCaptor<AssetSnapshot> saved = ArgumentCaptor.forClass(AssetSnapshot.class);
        verify(repo).save(saved.capture());
        assertThat(saved.getValue()).isSameAs(existing);
        assertThat(existing.total()).isEqualTo(26);
        assertThat(existing.getCapturedAt()).isEqualTo(java.time.LocalDateTime.of(2026, 11, 10, 12, 0));
    }

    @Test
    void 없는_회원은_거절() {
        when(members.findById(9L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.recordCurrent(9L, req(0, 0, 0, 0))).isInstanceOf(IllegalArgumentException.class);
        verify(repo, never()).save(any());
    }
}
