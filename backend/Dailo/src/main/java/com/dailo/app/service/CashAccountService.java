package com.dailo.app.service;

import com.dailo.app.dto.CashAccountDto;
import com.dailo.app.entity.CashAccount;
import com.dailo.app.entity.CashAsset;
import com.dailo.app.repository.CashAccountRepository;
import com.dailo.app.repository.CashAssetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;

// 현금 계좌 CRUD — 바뀔 때마다 그 정산월 cash_asset 잔액을 '켜진 계좌 합계'로 맞춤
//  정산월은 월급일(프론트 localStorage salaryDay) 기준이라 프론트가 ?settleMonth=로 보냄
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CashAccountService {

    private static final Pattern YEAR_MONTH = Pattern.compile("\\d{4}-(0[1-9]|1[0-2])");

    private final CashAccountRepository accountRepo;
    private final CashAssetRepository cashAssetRepo;

    public List<CashAccountDto.Response> list(Long memberId) {
        return accountRepo.findByMemberIdOrderBySortOrderAscIdAsc(memberId).stream()
                .map(CashAccountDto.Response::from).toList();
    }

    @Transactional
    public CashAccountDto.Response create(Long memberId, CashAccountDto.Request req, String settleMonth) {
        int nextOrder = accountRepo.findByMemberIdOrderBySortOrderAscIdAsc(memberId).size();
        CashAccount saved = accountRepo.save(CashAccount.builder()
                .memberId(memberId).name(req.getName().trim()).bank(blankToNull(req.getBank()))
                .balance(req.getBalance()).memo(blankToNull(req.getMemo())).sortOrder(nextOrder)
                .build());
        syncMonth(memberId, settleMonth);
        return CashAccountDto.Response.from(saved);
    }

    @Transactional
    public CashAccountDto.Response update(Long memberId, Long id, CashAccountDto.Request req, String settleMonth) {
        CashAccount acc = findOwned(memberId, id);
        acc.update(req.getName().trim(), blankToNull(req.getBank()), req.getBalance(), blankToNull(req.getMemo()));
        syncMonth(memberId, settleMonth);
        return CashAccountDto.Response.from(acc);
    }

    @Transactional
    public void setActive(Long memberId, Long id, boolean active, String settleMonth) {
        findOwned(memberId, id).updateActive(active);
        syncMonth(memberId, settleMonth);
    }

    @Transactional
    public void delete(Long memberId, Long id, String settleMonth) {
        accountRepo.delete(findOwned(memberId, id));
        accountRepo.flush();
        syncMonth(memberId, settleMonth);
    }

    // 그 정산월 현금 자산 = 켜진 현금 계좌 잔액 합계 (메모·생활비 잉여 반영 기록은 유지)
    //  계좌를 다 지우면 기록은 그대로 둠 — 예전 방식(직접 입력)으로 돌아간 것
    private void syncMonth(Long memberId, String settleMonth) {
        if (settleMonth == null || !YEAR_MONTH.matcher(settleMonth).matches()) {
            throw new IllegalArgumentException("정산월 형식이 올바르지 않습니다 (예: 2026-07)");
        }
        List<CashAccount> accounts = accountRepo.findByMemberIdOrderBySortOrderAscIdAsc(memberId);
        if (accounts.isEmpty()) return;
        long sum = accounts.stream().filter(CashAccount::isOn).mapToLong(CashAccount::getBalance).sum();
        int balance = (int) Math.max(Math.min(sum, Integer.MAX_VALUE), Integer.MIN_VALUE);
        cashAssetRepo.findByMemberIdAndSettleMonth(memberId, settleMonth).ifPresentOrElse(
                c -> c.update(balance, c.getLivingSurplusApplied(), c.getMemo()),
                () -> cashAssetRepo.save(CashAsset.builder().memberId(memberId).settleMonth(settleMonth).balance(balance).build()));
    }

    // 다른 회원 계좌 접근 방지 — 존재 여부를 숨기려고 not-found와 같은 메시지
    private CashAccount findOwned(Long memberId, Long id) {
        return accountRepo.findByIdAndMemberId(id, memberId)
                .orElseThrow(() -> new IllegalArgumentException("현금 계좌를 찾을 수 없습니다: " + id));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
