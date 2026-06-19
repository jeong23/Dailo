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
    }

    @Getter @Builder
    public static class SettingResponse {
        private Long id;
        private Integer monthlyBudget;
        private Float rebalanceThreshold;
        private Integer pensionLimit;

        public static SettingResponse from(InvestSetting s) {
            return SettingResponse.builder()
                    .id(s.getId())
                    .monthlyBudget(s.getMonthlyBudget())
                    .rebalanceThreshold(s.getRebalanceThreshold())
                    .pensionLimit(s.getPensionLimit())
                    .build();
        }
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
    }

    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class AccountRequest {
        private Long id;       // null = 신규
        private String name;
        private String type;   // PENSION, GENERAL, IRP
        private Float targetPct;
        private Integer sortOrder;
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
    }

    @Getter @Builder
    public static class AccountResponse {
        private Long id;
        private String name;
        private String type;
        private Float targetPct;
        private Integer sortOrder;
        private List<HoldingResponse> holdings;
    }

    // ─── Dashboard ─────────────────────────────────────────────
    @Getter @Builder
    public static class DashboardHolding {
        private Long recordId;
        private Long holdingId;
        private String ticker;
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
        private Integer accountPlannedAmt;
        private Integer accountActualAmt;
        private List<DashboardHolding> holdings;
    }

    @Getter @Builder
    public static class DashboardResponse {
        private String yearMonth;
        private Integer monthlyBudget;
        private Float rebalanceThreshold;
        private Integer pensionLimit;
        private Integer totalPlanned;
        private Integer totalActual;
        private Integer pensionYtdActual; // 연간 연금 납입 누계
        private List<DashboardAccount> accounts;
    }

    // ─── Record 업데이트 ───────────────────────────────────────
    @Getter @NoArgsConstructor @AllArgsConstructor
    public static class RecordUpdateRequest {
        private Integer actualAmt;
        private Boolean isPaid;
        private Integer currentPrice; // 현재가 (null이면 기존 값 유지)
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