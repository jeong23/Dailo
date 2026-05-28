package com.dailo.app.service;

import com.dailo.app.dto.InvestDto;
import com.dailo.app.entity.*;
import com.dailo.app.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InvestService {

    private final InvestSettingRepository settingRepo;
    private final InvestAccountRepository accountRepo;
    private final InvestHoldingRepository holdingRepo;
    private final InvestMonthlyRecordRepository recordRepo;
    private final InvestDiaryRepository diaryRepo;

    // ─── Setting ───────────────────────────────────────────────

    public InvestDto.SettingResponse getSetting(Long memberId) {
        return settingRepo.findByMemberId(memberId)
                .map(InvestDto.SettingResponse::from)
                .orElse(InvestDto.SettingResponse.builder()
                        .monthlyBudget(0)
                        .rebalanceThreshold(5.0f)
                        .pensionLimit(6_000_000)
                        .build());
    }

    @Transactional
    public InvestDto.SettingResponse saveSetting(Long memberId, InvestDto.SettingRequest req) {
        InvestSetting setting = settingRepo.findByMemberId(memberId).orElse(null);
        if (setting == null) {
            setting = settingRepo.save(InvestSetting.builder()
                    .memberId(memberId)
                    .monthlyBudget(req.getMonthlyBudget())
                    .rebalanceThreshold(req.getRebalanceThreshold() != null ? req.getRebalanceThreshold() : 5.0f)
                    .pensionLimit(req.getPensionLimit() != null ? req.getPensionLimit() : 6_000_000)
                    .build());
        } else {
            setting.update(
                    req.getMonthlyBudget(),
                    req.getRebalanceThreshold() != null ? req.getRebalanceThreshold() : setting.getRebalanceThreshold(),
                    req.getPensionLimit() != null ? req.getPensionLimit() : setting.getPensionLimit()
            );
        }
        return InvestDto.SettingResponse.from(setting);
    }

    // ─── Accounts + Holdings ───────────────────────────────────

    public List<InvestDto.AccountResponse> getAccounts(Long memberId) {
        return accountRepo.findByMemberIdOrderBySortOrderAsc(memberId).stream()
                .map(acc -> {
                    List<InvestDto.HoldingResponse> holdings = holdingRepo
                            .findByAccountIdOrderBySortOrderAsc(acc.getId()).stream()
                            .map(h -> InvestDto.HoldingResponse.builder()
                                    .id(h.getId()).ticker(h.getTicker())
                                    .targetPct(h.getTargetPct()).sortOrder(h.getSortOrder())
                                    .build())
                            .collect(Collectors.toList());
                    return InvestDto.AccountResponse.builder()
                            .id(acc.getId()).name(acc.getName()).type(acc.getType())
                            .targetPct(acc.getTargetPct()).sortOrder(acc.getSortOrder())
                            .holdings(holdings)
                            .build();
                })
                .collect(Collectors.toList());
    }

    @Transactional
    public List<InvestDto.AccountResponse> saveAccounts(Long memberId, List<InvestDto.AccountRequest> accountReqs) {
        Set<Long> keptAccountIds = new HashSet<>();
        Set<Long> keptHoldingIds = new HashSet<>();

        for (InvestDto.AccountRequest ar : accountReqs) {
            InvestAccount account;
            if (ar.getId() != null) {
                account = accountRepo.findById(ar.getId())
                        .orElseThrow(() -> new IllegalArgumentException("계좌를 찾을 수 없습니다: " + ar.getId()));
                account.update(ar.getName(), ar.getType(), ar.getTargetPct(), ar.getSortOrder());
            } else {
                account = accountRepo.save(InvestAccount.builder()
                        .memberId(memberId).name(ar.getName()).type(ar.getType())
                        .targetPct(ar.getTargetPct()).sortOrder(ar.getSortOrder())
                        .build());
            }
            keptAccountIds.add(account.getId());

            if (ar.getHoldings() != null) {
                for (InvestDto.HoldingRequest hr : ar.getHoldings()) {
                    InvestHolding holding;
                    if (hr.getId() != null) {
                        holding = holdingRepo.findById(hr.getId())
                                .orElseThrow(() -> new IllegalArgumentException("종목을 찾을 수 없습니다: " + hr.getId()));
                        holding.update(hr.getTicker(), hr.getTargetPct(), hr.getSortOrder());
                    } else {
                        holding = holdingRepo.save(InvestHolding.builder()
                                .account(account).ticker(hr.getTicker())
                                .targetPct(hr.getTargetPct()).sortOrder(hr.getSortOrder())
                                .build());
                    }
                    keptHoldingIds.add(holding.getId());
                }
            }
        }

        // 요청에 없는 기존 계좌/종목 삭제
        List<InvestAccount> existingAccounts = accountRepo.findByMemberIdOrderBySortOrderAsc(memberId);
        for (InvestAccount acc : existingAccounts) {
            if (!keptAccountIds.contains(acc.getId())) {
                List<InvestHolding> accHoldings = holdingRepo.findByAccountIdOrderBySortOrderAsc(acc.getId());
                for (InvestHolding h : accHoldings) {
                    recordRepo.deleteByHoldingId(h.getId());
                }
                holdingRepo.deleteByAccountId(acc.getId());
                accountRepo.delete(acc);
            } else {
                // 계좌는 유지하되 요청에 없는 종목 삭제
                List<InvestHolding> accHoldings = holdingRepo.findByAccountIdOrderBySortOrderAsc(acc.getId());
                for (InvestHolding h : accHoldings) {
                    if (!keptHoldingIds.contains(h.getId())) {
                        recordRepo.deleteByHoldingId(h.getId());
                        holdingRepo.delete(h);
                    }
                }
            }
        }

        return getAccounts(memberId);
    }

    // ─── Dashboard ─────────────────────────────────────────────

    @Transactional
    public InvestDto.DashboardResponse getDashboard(Long memberId, String yearMonth) {
        InvestSetting setting = settingRepo.findByMemberId(memberId).orElse(null);
        int budget = setting != null && setting.getMonthlyBudget() != null ? setting.getMonthlyBudget() : 0;
        float threshold = setting != null ? setting.getRebalanceThreshold() : 5.0f;
        int pensionLimit = setting != null ? setting.getPensionLimit() : 6_000_000;

        List<InvestAccount> accounts = accountRepo.findByMemberIdOrderBySortOrderAsc(memberId);
        List<Long> accountIds = accounts.stream().map(InvestAccount::getId).collect(Collectors.toList());

        // 전체 holding 한 번에 조회 후 accountId 기준으로 그룹핑 (N+1 방지)
        Map<Long, List<InvestHolding>> holdingsByAccount = new HashMap<>();
        if (!accountIds.isEmpty()) {
            holdingRepo.findByAccountIdInOrderBySortOrderAsc(accountIds)
                    .forEach(h -> holdingsByAccount.computeIfAbsent(h.getAccount().getId(), k -> new ArrayList<>()).add(h));
        }

        List<Long> allHoldingIds = holdingsByAccount.values().stream()
                .flatMap(List::stream).map(InvestHolding::getId).collect(Collectors.toList());

        // 해당 월 레코드 조회 (없으면 자동 생성)
        Map<Long, InvestMonthlyRecord> recordMap = new HashMap<>();
        if (!allHoldingIds.isEmpty()) {
            recordRepo.findByHoldingIdInAndYearMonth(allHoldingIds, yearMonth)
                    .forEach(r -> recordMap.put(r.getHolding().getId(), r));
        }

        List<InvestDto.DashboardAccount> dashAccounts = new ArrayList<>();
        int totalPlanned = 0, totalActual = 0;

        for (InvestAccount acc : accounts) {
            List<InvestHolding> holdings = holdingsByAccount.getOrDefault(acc.getId(), Collections.emptyList());
            int accPlanned = 0, accActual = 0;
            List<InvestDto.DashboardHolding> dashHoldings = new ArrayList<>();

            for (InvestHolding h : holdings) {
                int planned = (int) Math.round(budget * (acc.getTargetPct() / 100.0) * (h.getTargetPct() / 100.0));
                float overallPct = acc.getTargetPct() * h.getTargetPct() / 100f;

                InvestMonthlyRecord rec = recordMap.get(h.getId());
                if (rec == null) {
                    rec = recordRepo.save(InvestMonthlyRecord.builder()
                            .holding(h).yearMonth(yearMonth)
                            .plannedAmt(planned).actualAmt(0).isPaid(false).currentPct(overallPct)
                            .build());
                    recordMap.put(h.getId(), rec);
                } else if (!Objects.equals(rec.getPlannedAmt(), planned)) {
                    rec.updatePlanned(planned);
                }

                int actual = rec.getActualAmt() != null ? rec.getActualAmt() : 0;
                float curPct = rec.getCurrentPct() != null ? rec.getCurrentPct() : overallPct;
                boolean rebalanceNeeded = Math.abs(curPct - overallPct) > threshold;

                dashHoldings.add(InvestDto.DashboardHolding.builder()
                        .recordId(rec.getId()).holdingId(h.getId()).ticker(h.getTicker())
                        .holdingTargetPct(h.getTargetPct()).overallTargetPct(overallPct)
                        .plannedAmt(planned).actualAmt(actual)
                        .isPaid(rec.getIsPaid() != null ? rec.getIsPaid() : false)
                        .currentPct(curPct).rebalanceNeeded(rebalanceNeeded)
                        .build());

                accPlanned += planned;
                accActual += actual;
            }

            totalPlanned += accPlanned;
            totalActual += accActual;

            dashAccounts.add(InvestDto.DashboardAccount.builder()
                    .id(acc.getId()).name(acc.getName()).type(acc.getType())
                    .targetPct(acc.getTargetPct())
                    .accountPlannedAmt(accPlanned).accountActualAmt(accActual)
                    .holdings(dashHoldings)
                    .build());
        }

        // 연금 연간 납입 누계 (DB에서 직접 합산)
        String yearPrefix = yearMonth.substring(0, 4);
        int pensionYtd = recordRepo.sumPensionYtdActual(memberId, yearPrefix);

        return InvestDto.DashboardResponse.builder()
                .yearMonth(yearMonth).monthlyBudget(budget)
                .rebalanceThreshold(threshold).pensionLimit(pensionLimit)
                .totalPlanned(totalPlanned).totalActual(totalActual)
                .pensionYtdActual(pensionYtd)
                .accounts(dashAccounts)
                .build();
    }

    @Transactional
    public void updateRecord(Long recordId, InvestDto.RecordUpdateRequest req) {
        InvestMonthlyRecord record = recordRepo.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException("레코드를 찾을 수 없습니다: " + recordId));
        record.updateActual(req.getActualAmt(), req.getIsPaid(), req.getCurrentPct());
    }

    // ─── Diary ─────────────────────────────────────────────────

    public List<InvestDto.DiaryResponse> getDiaries(Long memberId, int year, int month) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
        return diaryRepo.findByMemberIdAndDateBetweenOrderByDateDesc(memberId, start, end)
                .stream().map(InvestDto.DiaryResponse::from).collect(Collectors.toList());
    }

    @Transactional
    public InvestDto.DiaryResponse saveDiary(Long memberId, InvestDto.DiaryRequest req) {
        InvestDiary diary = diaryRepo.findByMemberIdAndDate(memberId, req.getDate()).orElse(null);
        if (diary == null) {
            diary = diaryRepo.save(InvestDiary.builder()
                    .memberId(memberId).date(req.getDate())
                    .marketMood(req.getMarketMood()).myEmotion(req.getMyEmotion())
                    .title(req.getTitle()).body(req.getBody())
                    .build());
        } else {
            diary.update(req.getMarketMood(), req.getMyEmotion(), req.getTitle(), req.getBody());
        }
        return InvestDto.DiaryResponse.from(diary);
    }

    @Transactional
    public void deleteDiary(Long id) {
        diaryRepo.deleteById(id);
    }
}