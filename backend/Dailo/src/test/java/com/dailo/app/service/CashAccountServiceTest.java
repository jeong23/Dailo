package com.dailo.app.service;

import com.dailo.app.dto.CashAccountDto;
import com.dailo.app.entity.CashAccount;
import com.dailo.app.entity.CashAsset;
import com.dailo.app.repository.CashAccountRepository;
import com.dailo.app.repository.CashAssetRepository;
import com.dailo.app.repository.DailyExpenseRepository;
import com.dailo.app.repository.FixedCostRepository;
import com.dailo.app.repository.IncomeRepository;
import com.dailo.app.repository.MemberRepository;
import com.dailo.app.repository.MonthlyBudgetRepository;
import com.dailo.app.repository.SavingsRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

// 현금 계좌: 다른 회원 계좌는 못 건드리고, 바뀔 때마다 그 달 현금 자산 = 켜진 계좌 합계 (기록이 없으면 기준 잔액 그대로)
class CashAccountServiceTest {

    private static final Long ME = 1L;
    private static final String MONTH = "2026-11";

    private final CashAccountRepository accountRepo = mock(CashAccountRepository.class);
    private final CashAssetRepository assetRepo = mock(CashAssetRepository.class);
    private final CashBalanceService balanceService = new CashBalanceService(accountRepo, assetRepo,
            mock(DailyExpenseRepository.class), mock(IncomeRepository.class), mock(MonthlyBudgetRepository.class), mock(FixedCostRepository.class),
            mock(SavingsRepository.class), mock(MemberRepository.class));
    private final CashAccountService service = new CashAccountService(accountRepo, assetRepo, balanceService, mock(MemberRepository.class));

    private CashAccount account(long balance, Boolean active) {
        return CashAccount.builder().memberId(ME).name("통장").balance(balance).active(active).build();
    }

    @Test
    void 다른_회원_계좌는_수정_삭제_토글_불가() {
        when(accountRepo.findByIdAndMemberId(9L, ME)).thenReturn(Optional.empty());
        CashAccountDto.Request req = new CashAccountDto.Request("x", null, 1L, null);
        assertThatThrownBy(() -> service.update(ME, 9L, req, MONTH)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.delete(ME, 9L, MONTH)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.setActive(ME, 9L, false, MONTH)).isInstanceOf(IllegalArgumentException.class);
        verify(accountRepo, never()).delete(any());
    }

    @Test
    void 현금_자산은_켜진_계좌_합계로_기록() {
        CashAccount on = account(1_000_000, null);
        CashAccount off = account(500_000, false);
        when(accountRepo.findByIdAndMemberId(5L, ME)).thenReturn(Optional.of(on));
        when(accountRepo.findByMemberIdOrderBySortOrderAscIdAsc(ME)).thenReturn(List.of(on, off));
        when(assetRepo.findByMemberIdAndSettleMonth(ME, MONTH)).thenReturn(Optional.empty());

        service.setActive(ME, 5L, true, MONTH);

        ArgumentCaptor<CashAsset> saved = ArgumentCaptor.forClass(CashAsset.class);
        verify(assetRepo).save(saved.capture());
        assertThat(saved.getValue().getBalance()).isEqualTo(1_000_000);
        assertThat(saved.getValue().getSettleMonth()).isEqualTo(MONTH);
    }

    @Test
    void 정산월_형식이_틀리면_거부() {
        when(accountRepo.findByIdAndMemberId(5L, ME)).thenReturn(Optional.of(account(1, null)));
        assertThatThrownBy(() -> service.setActive(ME, 5L, true, "2026-13")).isInstanceOf(IllegalArgumentException.class);
    }
}
