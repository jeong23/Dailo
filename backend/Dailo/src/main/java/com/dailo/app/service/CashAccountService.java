package com.dailo.app.service;

import com.dailo.app.dto.CashAccountDto;
import com.dailo.app.entity.CashAccount;
import com.dailo.app.entity.CashAsset;
import com.dailo.app.repository.CashAccountRepository;
import com.dailo.app.repository.CashAssetRepository;
import com.dailo.app.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.regex.Pattern;

// 현금 계좌 CRUD — 잔액 = 기준 잔액 + 그 뒤 지출·수입·월급·고정비 (CashBalanceService)
//  잔액을 다른 값으로 저장하면 '잔액 맞추기' = 지금 시각이 새 기준. 바뀔 때마다 그 정산월 cash_asset도 계산값으로 맞춤
//  정산월은 월급일(프론트 localStorage salaryDay) 기준이라 프론트가 ?settleMonth=로 보냄
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CashAccountService {

    private static final Pattern YEAR_MONTH = Pattern.compile("\\d{4}-(0[1-9]|1[0-2])");

    private final CashAccountRepository accountRepo;
    private final CashAssetRepository cashAssetRepo;
    private final CashBalanceService balanceService;
    private final MemberRepository memberRepo;

    public List<CashAccountDto.Response> list(Long memberId, String settleMonth) {
        CashFlow.Result r = balanceService.compute(memberId, settleMonth);
        return accountRepo.findByMemberIdOrderBySortOrderAscIdAsc(memberId).stream()
                .map(a -> CashAccountDto.Response.from(a, r.accounts().get(a.getId()))).toList();
    }

    @Transactional
    public CashAccountDto.Response create(Long memberId, CashAccountDto.Request req, String settleMonth) {
        int nextOrder = accountRepo.findByMemberIdOrderBySortOrderAscIdAsc(memberId).size();
        CashAccount saved = accountRepo.save(CashAccount.builder()
                .memberId(memberId).name(req.getName().trim()).bank(blankToNull(req.getBank()))
                .balance(req.getBalance()).balanceAsOf(LocalDateTime.now()).balanceMonth(checkMonth(settleMonth))
                .memo(blankToNull(req.getMemo())).sortOrder(nextOrder)
                .build());
        return CashAccountDto.Response.from(saved, syncMonth(memberId, settleMonth).accounts().get(saved.getId()));
    }

    @Transactional
    public CashAccountDto.Response update(Long memberId, Long id, CashAccountDto.Request req, String settleMonth) {
        CashAccount acc = findOwned(memberId, id);
        checkMonth(settleMonth);
        // 화면엔 현재 잔액(계산값)을 보여주므로 그대로면 기준을 안 바꿈 — 이름만 고친 경우
        CashFlow.AccountBalance now = balanceService.compute(memberId, settleMonth).accounts().get(id);
        if (acc.getBalanceAsOf() == null || now == null || now.current() != req.getBalance()) {
            acc.anchor(req.getBalance(), LocalDateTime.now(), settleMonth);
        }
        acc.update(req.getName().trim(), blankToNull(req.getBank()), blankToNull(req.getMemo()));
        return CashAccountDto.Response.from(acc, syncMonth(memberId, settleMonth).accounts().get(id));
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

    // 지금 계산된 잔액을 새 기준 잔액으로 고정 (모든 계좌 '잔액 맞추기') + 지난 달 말 잔액은 cash_asset에 저장
    //  적금 삭제·월 납입액 변경처럼 지난 기록이 바뀌는 일 전에 부름 — 안 그러면 이미 빠진 납입·받은 만기금이 잔액에서 되살아나거나 사라짐
    @Transactional
    public void snapshot(Long memberId) {
        List<CashAccount> accounts = accountRepo.findByMemberIdOrderBySortOrderAscIdAsc(memberId);
        if (accounts.isEmpty()) return;
        int salaryDay = memberRepo.findById(memberId).map(m -> m.getSalaryDay())
                .filter(d -> d != null && d >= 1 && d <= 31).orElse(25);
        String month = CashFlow.settleMonthOf(LocalDate.now(), salaryDay);
        CashFlow.Result r = balanceService.compute(memberId, month);
        r.monthEnd().forEach((m, v) -> writeMonth(memberId, m, v));
        LocalDateTime now = LocalDateTime.now();
        for (CashAccount a : accounts) {
            CashFlow.AccountBalance b = r.accounts().get(a.getId());
            if (b != null) a.anchor(b.current(), now, month);
        }
    }

    // 그 정산월 현금 자산 = 켜진 계좌 달말 잔액 계산값 (메모·생활비 잉여 반영 기록은 유지)
    //  조회는 CashAssetService가 매번 다시 계산 — 이 저장값은 계좌를 다 지웠을 때 남는 기록
    //  계좌를 다 지우면 기록은 그대로 둠 — 예전 방식(직접 입력)으로 돌아간 것
    private CashFlow.Result syncMonth(Long memberId, String settleMonth) {
        checkMonth(settleMonth);
        accountRepo.flush();
        CashFlow.Result r = balanceService.compute(memberId, settleMonth);
        List<CashAccount> accounts = accountRepo.findByMemberIdOrderBySortOrderAscIdAsc(memberId);
        if (accounts.isEmpty()) return r;
        long sum = r.monthEnd().getOrDefault(settleMonth, accounts.stream().filter(CashAccount::isOn)
                .mapToLong(a -> r.accounts().containsKey(a.getId()) ? r.accounts().get(a.getId()).current() : a.getBalance()).sum());
        writeMonth(memberId, settleMonth, sum);
        return r;
    }

    private void writeMonth(Long memberId, String settleMonth, long sum) {
        int balance = (int) Math.max(Math.min(sum, Integer.MAX_VALUE), Integer.MIN_VALUE);
        cashAssetRepo.findByMemberIdAndSettleMonth(memberId, settleMonth).ifPresentOrElse(
                c -> c.update(balance, c.getLivingSurplusApplied(), c.getMemo()),
                () -> cashAssetRepo.save(CashAsset.builder().memberId(memberId).settleMonth(settleMonth).balance(balance).build()));
    }

    private static String checkMonth(String settleMonth) {
        if (settleMonth == null || !YEAR_MONTH.matcher(settleMonth).matches()) {
            throw new IllegalArgumentException("정산월 형식이 올바르지 않습니다 (예: 2026-07)");
        }
        return settleMonth;
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
