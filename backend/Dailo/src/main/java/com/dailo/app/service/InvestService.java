package com.dailo.app.service;

import com.dailo.app.dto.InvestDto;
import com.dailo.app.entity.*;
import com.dailo.app.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
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
    private final ApplicationEventPublisher eventPublisher;
    private final InvestThemeRepository themeRepo;
    private final MonthlyBudgetRepository monthlyBudgetRepo;
    private final BudgetAllocationItemRepository allocationItemRepo;

    // ─── Setting ───────────────────────────────────────────────

    public InvestDto.SettingResponse getSetting(Long memberId) {
        InvestSetting setting = settingRepo.findByMemberId(memberId).orElse(null);
        return withMode(memberId, setting, setting != null ? InvestDto.SettingResponse.from(setting)
                : InvestDto.SettingResponse.builder()
                        .monthlyBudget(0)
                        .rebalanceThreshold(5.0f)
                        .pensionLimit(6_000_000)
                        .allowSell(true)
                        .build());
    }

    private InvestDto.SettingResponse withMode(Long memberId, InvestSetting setting, InvestDto.SettingResponse r) {
        boolean[] mode = rebalanceMode(memberId, setting);
        return r.toBuilder().rebalanceMode(mode[0]).rebalanceModeChosen(mode[1]).build();
    }

    // 리밸런싱 모드 {켜짐, 고른 적 있음} — 안 골랐으면 테마·전략 프리셋이 있는 사용자(이미 목표 비중으로 쓰던 사람)는 켜진 걸로 보고 묻지 않음
    //  새 사용자는 기록 모드로 시작 + 화면에서 한 번 물어봄
    boolean[] rebalanceMode(Long memberId, InvestSetting setting) {
        if (setting != null && setting.getRebalanceMode() != null) return new boolean[]{setting.getRebalanceMode(), true};
        boolean inferred = (setting != null && setting.getStrategyPreset() != null)
                || !themeRepo.findByMemberIdOrderBySortOrderAsc(memberId).isEmpty();
        return new boolean[]{inferred, inferred};
    }

    @Transactional
    public InvestDto.SettingResponse setRebalanceMode(Long memberId, InvestDto.RebalanceModeRequest req) {
        if (req.getEnabled() == null) throw new IllegalArgumentException("enabled 값이 필요해요");
        InvestSetting setting = settingRepo.findByMemberId(memberId).orElseGet(() -> settingRepo.save(InvestSetting.builder()
                .memberId(memberId).monthlyBudget(0).rebalanceThreshold(5.0f).pensionLimit(6_000_000).build()));
        setting.updateRebalanceMode(req.getEnabled());
        return withMode(memberId, setting, InvestDto.SettingResponse.from(setting));
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
            setting.updateStrategy(req.getAllowSell(), normalizePreset(req.getStrategyPreset()));
        } else {
            setting.update(
                    req.getMonthlyBudget(),
                    req.getRebalanceThreshold() != null ? req.getRebalanceThreshold() : setting.getRebalanceThreshold(),
                    req.getPensionLimit() != null ? req.getPensionLimit() : setting.getPensionLimit()
            );
            setting.updateStrategy(req.getAllowSell(), normalizePreset(req.getStrategyPreset()));
        }
        return withMode(memberId, setting, InvestDto.SettingResponse.from(setting));
    }

    // 최신 정산월 예산에서 투자 계좌에 연결된 항목 → {계좌 id: 항목명}. 이 계좌들의 월 납입금은 예산 설정이 기준
    private Map<Long, String> budgetLinkedLabels(Long memberId) {
        Map<Long, String> out = new HashMap<>();
        monthlyBudgetRepo.findByMemberIdOrderBySettleMonthDesc(memberId).stream().findFirst().ifPresent(b ->
                allocationItemRepo.findByMonthlyBudgetIdOrderBySortOrderAsc(b.getId()).forEach(i -> {
                    if (i.getInvestAccountId() != null) out.merge(i.getInvestAccountId(), i.getLabel(), (x, y) -> x + "·" + y);
                }));
        return out;
    }

    // 세액공제 계산기 입력 — 설정 행이 없으면 기본값으로 만들고 입력만 채움
    @Transactional
    public InvestDto.SettingResponse saveTaxInputs(Long memberId, InvestDto.TaxInputsRequest req) {
        int join = monthOrThrow(req.getJoinMonth() != null ? req.getJoinMonth() : 1, "입사월");
        boolean probation = Boolean.TRUE.equals(req.getProbation());
        Integer probEnd = probation ? monthOrThrow(req.getProbEndMonth() != null ? req.getProbEndMonth() : 3, "수습 종료월") : req.getProbEndMonth();
        InvestSetting setting = settingRepo.findByMemberId(memberId).orElseGet(() -> settingRepo.save(InvestSetting.builder()
                .memberId(memberId).monthlyBudget(0).rebalanceThreshold(5.0f).pensionLimit(6_000_000).build()));
        setting.updateTaxInputs(join, probation, probEnd);
        return withMode(memberId, setting, InvestDto.SettingResponse.from(setting));
    }

    @Transactional
    public void setTradeCosts(Long memberId, InvestDto.TradeCostsRequest req) {
        if (req.getFeeRate() != null && (req.getFeeRate() < 0 || req.getFeeRate() > 1)) throw new IllegalArgumentException("수수료는 0~1% 사이로 입력해주세요");
        if (req.getPriceBuffer() != null && (req.getPriceBuffer() < 0 || req.getPriceBuffer() > 5)) throw new IllegalArgumentException("가격 여유는 0~5% 사이로 입력해주세요");
        InvestSetting setting = settingRepo.findByMemberId(memberId).orElseGet(() -> settingRepo.save(InvestSetting.builder()
                .memberId(memberId).monthlyBudget(0).rebalanceThreshold(5.0f).pensionLimit(6_000_000).build()));
        setting.updateTradeCosts(req.getFeeRate(), req.getPriceBuffer());
    }

    @Transactional
    public void setDeposited(Long memberId, InvestDto.DepositedRequest req) {
        String ym = req.getYearMonth();
        if (ym == null || !ym.matches("\\d{4}-(0[1-9]|1[0-2])")) throw new IllegalArgumentException("yearMonth 형식은 yyyy-MM이에요");
        InvestSetting setting = settingRepo.findByMemberId(memberId).orElseGet(() -> settingRepo.save(InvestSetting.builder()
                .memberId(memberId).monthlyBudget(0).rebalanceThreshold(5.0f).pensionLimit(6_000_000).build()));
        setting.markDeposited(ym, Boolean.TRUE.equals(req.getDeposited()));
    }

    private static int monthOrThrow(int m, String label) {
        if (m < 1 || m > 12) throw new IllegalArgumentException(label + "은 1~12월이어야 해요");
        return m;
    }

    // ─── Accounts + Holdings ───────────────────────────────────

    public List<InvestDto.AccountResponse> getAccounts(Long memberId) {
        Map<Long, String> linked = budgetLinkedLabels(memberId);
        return accountRepo.findByMemberIdOrderBySortOrderAsc(memberId).stream()
                .map(acc -> {
                    List<InvestDto.HoldingResponse> holdings = holdingRepo
                            .findByAccountIdOrderBySortOrderAsc(acc.getId()).stream()
                            .map(h -> InvestDto.HoldingResponse.builder()
                                    .id(h.getId()).ticker(h.getTicker())
                                    .targetPct(h.getTargetPct()).sortOrder(h.getSortOrder())
                                    .avgPurchasePrice(h.getAvgPurchasePrice()).shares(h.getShares())
                                    .stockCode(h.getStockCode())
                                    .themeId(h.getThemeId()).manualValue(h.getManualValue())
                                    .build())
                            .collect(Collectors.toList());
                    return InvestDto.AccountResponse.builder()
                            .id(acc.getId()).name(acc.getName()).type(acc.getType())
                            .targetPct(acc.getTargetPct()).sortOrder(acc.getSortOrder())
                            .monthlyAmount(acc.getMonthlyAmount()).purpose(acc.getPurpose()).targetDate(acc.getTargetDate())
                            .active(acc.isOn())
                            .linkedBudgetLabel(linked.get(acc.getId()))
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
                        .filter(a -> a.getMemberId().equals(memberId)) // 다른 회원 계좌 id로 덮어쓰기 방지
                        .orElseThrow(() -> new IllegalArgumentException("계좌를 찾을 수 없습니다: " + ar.getId()));
                account.update(ar.getName(), ar.getType(), ar.getTargetPct(), ar.getSortOrder());
            } else {
                account = accountRepo.save(InvestAccount.builder()
                        .memberId(memberId).name(ar.getName()).type(ar.getType())
                        .targetPct(ar.getTargetPct()).sortOrder(ar.getSortOrder())
                        .build());
            }
            account.updatePlan(nonNegativeOrNull(ar.getMonthlyAmount()), normalizePurpose(ar.getPurpose()), normalizeYearMonth(ar.getTargetDate()));
            account.updateActive(ar.getActive());
            keptAccountIds.add(account.getId());

            if (ar.getHoldings() != null) {
                // 한 계좌에 같은 종목코드가 두 줄이면 비중·평가금액·리밸런싱이 둘로 쪼개져 틀어짐 → 저장 거부
                Set<String> codesInAccount = new HashSet<>();
                for (InvestDto.HoldingRequest hr : ar.getHoldings()) {
                    InvestHolding holding;
                    String stockCode = normalizeStockCode(hr.getStockCode());
                    if (stockCode != null && !codesInAccount.add(stockCode)) {
                        throw new IllegalArgumentException("'" + ar.getName() + "' 계좌에 종목코드 " + stockCode + "가 두 번 있어요. 한 줄로 합쳐주세요");
                    }
                    if (hr.getId() != null) {
                        holding = holdingRepo.findById(hr.getId())
                                .filter(h -> h.getAccount().getMemberId().equals(memberId))
                                .orElseThrow(() -> new IllegalArgumentException("종목을 찾을 수 없습니다: " + hr.getId()));
                        holding.update(hr.getTicker(), hr.getTargetPct(), hr.getSortOrder(),
                                hr.getAvgPurchasePrice(), hr.getShares(), stockCode);
                    } else {
                        holding = holdingRepo.save(InvestHolding.builder()
                                .account(account).ticker(hr.getTicker())
                                .targetPct(hr.getTargetPct()).sortOrder(hr.getSortOrder())
                                .avgPurchasePrice(hr.getAvgPurchasePrice()).shares(hr.getShares())
                                .stockCode(stockCode)
                                .build());
                    }
                    holding.assign(ownedThemeId(memberId, hr.getThemeId()), positiveOrNull(hr.getManualValue()));
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

        // 커밋 후 실시간 시세 구독 종목을 다시 맞춤 (QuoteService가 AFTER_COMMIT으로 수신)
        eventPublisher.publishEvent(new InvestHoldingsChangedEvent());
        return getAccounts(memberId);
    }

    // 테마 id는 본인 테마만 (다른 회원 테마 id면 400)
    private Long ownedThemeId(Long memberId, Long themeId) {
        if (themeId == null) return null;
        return themeRepo.findById(themeId)
                .filter(t -> t.getMemberId().equals(memberId))
                .map(InvestTheme::getId)
                .orElseThrow(() -> new IllegalArgumentException("테마를 찾을 수 없습니다: " + themeId));
    }

    private static Integer nonNegativeOrNull(Integer v) {
        if (v == null) return null;
        if (v < 0) throw new IllegalArgumentException("납입금은 0원 이상이어야 해요");
        return v;
    }

    private static final Set<String> PURPOSES = Set.of("RETIRE", "HOUSE", "WEDDING", "OTHER");
    private static final Set<String> PRESETS = Set.of("LIQUIDITY", "TAX", "EQUAL", "CUSTOM");

    private static String normalizePurpose(String v) {
        if (v == null || v.isBlank()) return null;
        if (!PURPOSES.contains(v)) throw new IllegalArgumentException("알 수 없는 계좌 목적이에요: " + v);
        return v;
    }

    private static String normalizePreset(String v) {
        if (v == null || v.isBlank()) return null;
        if (!PRESETS.contains(v)) throw new IllegalArgumentException("알 수 없는 전략이에요: " + v);
        return v;
    }

    // 'YYYY-MM' (월 01~12)만 허용
    private static String normalizeYearMonth(String v) {
        if (v == null || v.isBlank()) return null;
        if (!v.matches("\\d{4}-(0[1-9]|1[0-2])")) throw new IllegalArgumentException("사용 예정 월은 YYYY-MM 형식이어야 해요: " + v);
        return v;
    }

    private static Integer positiveOrNull(Integer v) {
        return v != null && v > 0 ? v : null;
    }

    // 종목코드: 공백 제거 + 대문자, 빈 값은 null. 국내 종목코드는 6자리 영숫자(신규 ETF는 0001A0처럼 영문 포함)
    static String normalizeStockCode(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String code = raw.trim().toUpperCase();
        if (!code.matches("[0-9A-Z]{6}")) {
            throw new IllegalArgumentException("종목코드는 6자리여야 합니다: " + raw);
        }
        return code;
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

        // Phase 1: ensure all records exist
        int totalPlanned = 0, totalActual = 0;
        for (InvestAccount acc : accounts) {
            for (InvestHolding h : holdingsByAccount.getOrDefault(acc.getId(), Collections.emptyList())) {
                int planned = (int) Math.round(acc.contribution(budget) * (h.getTargetPct() / 100.0));
                float overallPct = acc.getTargetPct() * h.getTargetPct() / 100f;
                InvestMonthlyRecord rec = recordMap.get(h.getId());
                if (rec == null) {
                    rec = recordRepo.save(InvestMonthlyRecord.builder()
                            .holding(h).yearMonth(yearMonth)
                            .plannedAmt(planned).actualAmt(0).isPaid(false)
                            .build());
                    recordMap.put(h.getId(), rec);
                } else if (!Objects.equals(rec.getPlannedAmt(), planned)) {
                    rec.updatePlanned(planned);
                }
                totalPlanned += planned;
                totalActual += rec.getActualAmt() != null ? rec.getActualAmt() : 0;
            }
        }

        // Phase 2: compute totalEvalAmt for portfolio weight calculation
        int totalEvalAmt = recordMap.values().stream()
                .mapToInt(r -> r.getEvalAmt() != null ? r.getEvalAmt() : 0).sum();

        // Phase 3: build DTO
        List<InvestDto.DashboardAccount> dashAccounts = new ArrayList<>();
        for (InvestAccount acc : accounts) {
            List<InvestHolding> holdings = holdingsByAccount.getOrDefault(acc.getId(), Collections.emptyList());
            int accPlanned = 0, accActual = 0;
            List<InvestDto.DashboardHolding> dashHoldings = new ArrayList<>();

            for (InvestHolding h : holdings) {
                int planned = (int) Math.round(acc.contribution(budget) * (h.getTargetPct() / 100.0));
                float overallPct = acc.getTargetPct() * h.getTargetPct() / 100f;
                InvestMonthlyRecord rec = recordMap.get(h.getId());
                int actual = rec.getActualAmt() != null ? rec.getActualAmt() : 0;
                Integer evalAmt = rec.getEvalAmt();

                // 현재 포트폴리오 비중 자동계산
                float curPct = (totalEvalAmt > 0 && evalAmt != null)
                        ? evalAmt * 100f / totalEvalAmt
                        : overallPct;
                boolean rebalanceNeeded = acc.isOn() && Math.abs(curPct - overallPct) > threshold;

                // 손익 계산
                Integer purchaseAmt = null, profitAmt = null;
                Float profitPct = null;
                if (h.getAvgPurchasePrice() != null && h.getShares() != null) {
                    purchaseAmt = Math.round(h.getAvgPurchasePrice() * h.getShares());
                    if (evalAmt != null) {
                        profitAmt = evalAmt - purchaseAmt;
                        profitPct = purchaseAmt > 0 ? profitAmt * 100f / purchaseAmt : null;
                    }
                }

                dashHoldings.add(InvestDto.DashboardHolding.builder()
                        .recordId(rec.getId()).holdingId(h.getId()).ticker(h.getTicker())
                        .stockCode(h.getStockCode())
                        .themeId(h.getThemeId()).manualValue(h.getManualValue())
                        .avgPurchasePrice(h.getAvgPurchasePrice()).shares(h.getShares())
                        .holdingTargetPct(h.getTargetPct()).overallTargetPct(overallPct)
                        .plannedAmt(planned).actualAmt(actual)
                        .isPaid(rec.getIsPaid() != null ? rec.getIsPaid() : false)
                        .currentPrice(rec.getCurrentPrice()).evalAmt(evalAmt)
                        .purchaseAmt(purchaseAmt).profitAmt(profitAmt).profitPct(profitPct)
                        .currentPct(curPct).rebalanceNeeded(rebalanceNeeded)
                        .build());

                accPlanned += planned;
                accActual += actual;
            }

            dashAccounts.add(InvestDto.DashboardAccount.builder()
                    .id(acc.getId()).name(acc.getName()).type(acc.getType())
                    .targetPct(acc.getTargetPct())
                    .contribution(acc.contribution(budget))
                    .purpose(acc.getPurpose()).targetDate(acc.getTargetDate())
                    .active(acc.isOn())
                    .accountPlannedAmt(accPlanned).accountActualAmt(accActual)
                    .holdings(dashHoldings)
                    .build());
        }

        // 연금 연간 납입 누계 (DB에서 직접 합산)
        String yearPrefix = yearMonth.substring(0, 4);
        int pensionYtd = recordRepo.sumPensionYtdActual(memberId, yearPrefix);

        int contributionTotal = accounts.stream().mapToInt(a -> a.contribution(budget)).sum();
        boolean[] mode = rebalanceMode(memberId, setting);
        return InvestDto.DashboardResponse.builder()
                .yearMonth(yearMonth).monthlyBudget(contributionTotal)
                .rebalanceThreshold(threshold).pensionLimit(pensionLimit)
                .allowSell(setting == null || setting.isSellAllowed())
                .strategyPreset(setting != null ? setting.getStrategyPreset() : null)
                .contributionDeposited(setting != null && setting.isDeposited(yearMonth))
                .rebalanceMode(mode[0]).rebalanceModeChosen(mode[1])
                .feeRate(setting != null ? setting.feeRateOrDefault() : InvestSetting.DEFAULT_FEE_RATE)
                .priceBuffer(setting != null ? setting.priceBufferOrDefault() : InvestSetting.DEFAULT_PRICE_BUFFER)
                .totalPlanned(totalPlanned).totalActual(totalActual)
                .pensionYtdActual(pensionYtd)
                .accounts(dashAccounts)
                .themes(themeRepo.findByMemberIdOrderBySortOrderAsc(memberId).stream().map(InvestDto.ThemeDto::from).toList())
                .build();
    }

    @Transactional
    public void setAccountActive(Long memberId, Long accountId, Boolean active) {
        if (active == null) throw new IllegalArgumentException("active 값이 필요해요");
        accountRepo.findById(accountId)
                .filter(a -> a.getMemberId().equals(memberId)) // 다른 회원 계좌 방지 — not-found와 같은 메시지
                .orElseThrow(() -> new IllegalArgumentException("계좌를 찾을 수 없습니다: " + accountId))
                .updateActive(active);
    }

    @Transactional
    public void updateRecord(Long memberId, Long recordId, InvestDto.RecordUpdateRequest req) {
        InvestMonthlyRecord record = recordRepo.findById(recordId)
                .orElseThrow(() -> new IllegalArgumentException("레코드를 찾을 수 없습니다: " + recordId));
        // 다른 회원의 납입 기록 수정 방지 (IDOR) — 존재 여부를 숨기려고 not-found와 같은 메시지 사용
        if (!record.getHolding().getAccount().getMemberId().equals(memberId)) {
            throw new IllegalArgumentException("레코드를 찾을 수 없습니다: " + recordId);
        }
        Integer evalAmt = null;
        if (req.getCurrentPrice() != null) {
            Float shares = record.getHolding().getShares();
            if (shares != null) {
                evalAmt = Math.round(req.getCurrentPrice() * shares);
            }
        }
        record.updateActual(req.getActualAmt(), req.getIsPaid(), req.getCurrentPrice(), evalAmt);
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
    public void deleteDiary(Long memberId, Long id) {
        InvestDiary diary = diaryRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("일기를 찾을 수 없습니다: " + id));
        // 다른 회원의 일기 삭제 방지 (IDOR)
        if (!diary.getMemberId().equals(memberId)) {
            throw new IllegalArgumentException("일기를 찾을 수 없습니다: " + id);
        }
        diaryRepo.delete(diary);
    }
}