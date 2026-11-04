package com.dailo.app.dto;

import com.dailo.app.entity.InvestDiary;
import com.dailo.app.entity.InvestSetting;
import lombok.*;

import java.time.LocalDate;
import java.util.List;

public class InvestDto {

    // ─── Setting ───────────────────────────────────────────────
    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class SettingRequest {
        private Integer monthlyBudget;
        private Float rebalanceThreshold;
        private Integer pensionLimit;
        private Boolean allowSell;        // null = 기존 값 유지
        private String strategyPreset;    // null = 기존 값 유지
    }

    @Getter @Builder(toBuilder = true)
    public static class SettingResponse {
        private Long id;
        private Integer monthlyBudget;
        private Float rebalanceThreshold;
        private Integer pensionLimit;
        private Boolean allowSell;
        private String strategyPreset;
        private Integer taxJoinMonth;     // null = 아직 입력 안 함
        private Boolean taxProbation;
        private Integer taxProbEndMonth;
        private Boolean rebalanceMode;        // 목표 비중 맞추기 기능 켜짐
        private Boolean rebalanceModeChosen;  // false = 아직 안 고름 → 화면에서 한 번 물어봄

        public static SettingResponse from(InvestSetting s) {
            return SettingResponse.builder()
                    .id(s.getId())
                    .monthlyBudget(s.getMonthlyBudget())
                    .rebalanceThreshold(s.getRebalanceThreshold())
                    .pensionLimit(s.getPensionLimit())
                    .allowSell(s.isSellAllowed())
                    .strategyPreset(s.getStrategyPreset())
                    .taxJoinMonth(s.getTaxJoinMonth())
                    .taxProbation(s.getTaxProbation())
                    .taxProbEndMonth(s.getTaxProbEndMonth())
                    .build();
        }
    }

    // 리밸런싱 모드 켜기/끄기 (PUT /setting/rebalance-mode)
    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class RebalanceModeRequest {
        private Boolean enabled;
    }

    // 계좌 켜기/끄기 (PATCH /accounts/{id}/active)
    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class ActiveRequest {
        private Boolean active;
    }

    // 매매 비용 (투자 현황 이번 달 할 일) — null = 기존 값 유지
    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class TradeCostsRequest {
        private Float feeRate;
        private Float priceBuffer;
    }

    // 리밸런싱 방식 — style: THEME | VALUE, profitTakePct: VALUE 수익 실현 기준 % (0 = 팔지 않음). null = 기존 값 유지
    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class RebalanceStyleRequest {
        private String style;
        private Float profitTakePct;
    }

    // 이 달 납입금을 이미 예수금에 넣었는지 (투자 현황 '납입금 포함' 토글)
    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class DepositedRequest {
        private String yearMonth;
        private Boolean deposited;
    }

    // 세액공제 계산기 입력만 저장 (월 투자금 등 다른 설정은 건드리지 않음)
    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class TaxInputsRequest {
        private Integer joinMonth;
        private Boolean probation;
        private Integer probEndMonth;
    }

    // ─── Account + Holding (설정 저장) ─────────────────────────
    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class HoldingRequest {
        private Long id;       // null = 신규
        private String ticker;
        private Float targetPct;
        private Integer sortOrder;
        private Integer avgPurchasePrice; // 매입 평균단가
        private Float shares;             // 보유 수량
        private String stockCode;         // 종목코드 6자리 (선택)
        private Long themeId;             // 투자 테마 (선택)
        private Integer manualValue;      // 현금성 항목 금액 (선택)
    }

    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class AccountRequest {
        private Long id;       // null = 신규
        private String name;
        private String type;   // PENSION, IRP, ISA, GENERAL
        private Float targetPct;
        private Integer sortOrder;
        private Integer monthlyAmount; // 매달 납입금 (null = 월 투자금 × targetPct)
        private String purpose;        // RETIRE / HOUSE / WEDDING / OTHER / null(미정)
        private String targetDate;     // 'YYYY-MM' / null(미정)
        private Boolean active;        // false = 계좌 끄기 (null = 기존 값 유지)
        private List<HoldingRequest> holdings;
    }

    @Getter @Builder
    public static class HoldingResponse {
        private Long id;
        private String ticker;
        private Float targetPct;
        private Integer sortOrder;
        private Integer avgPurchasePrice;
        private Float shares;
        private String stockCode;
        private Long themeId;
        private Integer manualValue;
    }

    @Getter @Builder
    public static class AccountResponse {
        private Long id;
        private String name;
        private String type;
        private Float targetPct;
        private Integer sortOrder;
        private Integer monthlyAmount;
        private String purpose;
        private String targetDate;
        private Boolean active;           // 계좌 사용 여부 (꺼지면 납입·추천 제외)
        private String linkedBudgetLabel; // 최신 달 예산 항목에 연결돼 있으면 그 항목명 (월 납입금은 예산 설정이 기준), 없으면 null
        private List<HoldingResponse> holdings;
    }

    // ─── Dashboard ─────────────────────────────────────────────
    @Getter @Builder
    public static class DashboardHolding {
        private Long recordId;
        private Long holdingId;
        private String ticker;
        private String stockCode;         // 실시간 시세 매칭용 (null이면 수동 현재가)
        private Long themeId;             // 투자 테마
        private Integer manualValue;      // 현금성 항목 직접 입력 금액
        private Integer avgPurchasePrice; // 매입 평균단가
        private Float shares;             // 보유 수량
        private Float holdingTargetPct;   // 계좌 내 목표비중
        private Float overallTargetPct;   // 전체 포트폴리오 목표비중
        private Integer plannedAmt;
        private Integer actualAmt;
        private Boolean isPaid;
        private Integer currentPrice;     // 현재가
        private Integer evalAmt;          // 평가금액 = currentPrice × shares
        private Integer purchaseAmt;      // 매입금액 = avgPurchasePrice × shares
        private Integer profitAmt;        // 평가손익 = evalAmt - purchaseAmt
        private Float profitPct;          // 수익률(%)
        private Float currentPct;         // 현재 포트폴리오 비중 (자동계산)
        private boolean rebalanceNeeded;
    }

    @Getter @Builder
    public static class DashboardAccount {
        private Long id;
        private String name;
        private String type;
        private Float targetPct;
        private Integer contribution;     // 이번 달 납입금 (계좌 monthlyAmount 또는 월 투자금 × targetPct)
        private String purpose;
        private String targetDate;
        private Boolean active;           // false = 꺼진 계좌 (납입 0, 리밸런싱 추천 제외 — 평가금액은 합계에 포함)
        private Integer accountPlannedAmt;
        private Integer accountActualAmt;
        private List<DashboardHolding> holdings;
    }

    @Getter @Builder
    public static class DashboardResponse {
        private String yearMonth;
        private Integer monthlyBudget;    // 계좌 납입금 합계
        private Float rebalanceThreshold;
        private Integer pensionLimit;
        private Boolean allowSell;
        private String strategyPreset;
        private Boolean contributionDeposited; // 이 달 납입금이 이미 예수금에 있음 → 추천 재원에 납입금 안 더함
        private Boolean rebalanceMode;    // false면 기록 모드 — 할 일·목표 비중 화면 숨김
        private Boolean rebalanceModeChosen;
        private Float feeRate;            // 매매 수수료 %
        private Float priceBuffer;        // 가격 변동 여유 %
        private String rebalanceStyle;    // THEME | VALUE (손해 큰 종목 우선 + 수익 실현)
        private Float profitTakePct;      // VALUE 수익 실현 기준 % (0 = 팔지 않음)
        private Integer totalPlanned;
        private Integer totalActual;
        private Integer pensionYtdActual; // 연간 연금 납입 누계
        private List<DashboardAccount> accounts;
        private List<ThemeDto> themes;    // 투자 테마 (목표 비중)
    }

    // ─── Theme (투자 테마) ─────────────────────────────────────
    @Getter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class ThemeDto {
        private Long id;          // null = 신규
        private String name;
        private Float targetPct;  // 투자 자산 전체 대비 %
        private Boolean cash;     // 현금성 테마 (금액으로 평가)
        private Boolean satellite; // 위성 테마 — targetPct = 상한, 매수 추천 안 함
        private Integer sortOrder;

        public static ThemeDto from(com.dailo.app.entity.InvestTheme t) {
            return new ThemeDto(t.getId(), t.getName(), t.getTargetPct(), t.getCash(), t.isSatelliteTheme(), t.getSortOrder());
        }
    }

    // ─── Asset bucket (전체 자산 배분) ──────────────────────────
    @Getter @Builder @NoArgsConstructor @AllArgsConstructor
    public static class BucketDto {
        private Long id;            // null = 신규
        private String name;
        private String kind;        // CASH / INVEST / MANUAL
        private Float targetPct;
        private Long manualAmount;  // MANUAL일 때 금액
        private Integer sortOrder;

        public static BucketDto from(com.dailo.app.entity.AssetBucket b) {
            return new BucketDto(b.getId(), b.getName(), b.getKind(), b.getTargetPct(), b.getManualAmount(), b.getSortOrder());
        }
    }

    // ─── Record 업데이트 ───────────────────────────────────────
    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class RecordUpdateRequest {
        private Integer actualAmt;
        private Boolean isPaid;
        private Integer currentPrice; // 현재가 (null이면 기존 값 유지)
    }

    // ─── Trade (체결 기록) ─────────────────────────────────────
    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class TradeRequest {
        private String side;        // BUY / SELL
        private Float shares;       // 체결 수량 (> 0)
        private Integer price;      // 체결 단가 (> 0)
        private LocalDate tradeDate; // 없으면 오늘
    }

    @Getter @Builder
    public static class TradeResponse {
        private Long id;
        private Long accountId;
        private Long holdingId;
        private String ticker;
        private String stockCode;
        private String side;
        private Float shares;
        private Integer price;
        private Long amount;
        private LocalDate tradeDate;
        private Float sharesAfter;  // 체결 후 보유 수량 (기록 시점)
        private Integer avgAfter;   // 체결 후 평균단가 (기록 시점)
        private Integer cashDelta;  // 예수금 줄에 반영한 금액 (매수 음수, 반영 안 했으면 null)

        public static TradeResponse of(com.dailo.app.entity.InvestTrade t, Float sharesAfter, Integer avgAfter) {
            return TradeResponse.builder()
                    .id(t.getId()).accountId(t.getAccountId()).holdingId(t.getHoldingId())
                    .ticker(t.getTicker()).stockCode(t.getStockCode()).side(t.getSide())
                    .shares(t.getShares()).price(t.getPrice())
                    .amount(Math.round((double) t.getShares() * t.getPrice()))
                    .tradeDate(t.getTradeDate())
                    .sharesAfter(sharesAfter).avgAfter(avgAfter)
                    .cashDelta(t.getCashDelta())
                    .build();
        }
    }

    // ─── Diary ─────────────────────────────────────────────────
    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class DiaryRequest {
        private LocalDate date;
        private String marketMood;  // BULLISH, NEUTRAL, BEARISH
        private String myEmotion;   // CONFIDENT, CALM, ANXIOUS, FEARFUL
        private String title;
        private String body;
    }

    @Getter @Builder
    public static class DiaryResponse {
        private Long id;
        private LocalDate date;
        private String marketMood;
        private String myEmotion;
        private String title;
        private String body;

        public static DiaryResponse from(InvestDiary d) {
            return DiaryResponse.builder()
                    .id(d.getId())
                    .date(d.getDate())
                    .marketMood(d.getMarketMood())
                    .myEmotion(d.getMyEmotion())
                    .title(d.getTitle())
                    .body(d.getBody())
                    .build();
        }
    }
}