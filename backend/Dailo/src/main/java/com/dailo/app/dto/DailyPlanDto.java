package com.dailo.app.dto;

import com.dailo.app.entity.DailyPlan;
import lombok.*;

import java.time.LocalDate;

public class DailyPlanDto {

    @Getter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class Request {
        private LocalDate planDate;
        private String futureVisionUrl;
        private String identity1;
        private String identity2;
        private String identity3;
        private String motivation1;
        private String motivation2;
        private String motivation3;
        private String gratitude1;
        private String gratitude2;
        private String gratitude3;
        private String firstTask;
        private String feedbackStart;
        private String feedbackMid;
        private String feedbackEnd;
    }

    @Getter
    @Builder
    public static class Response {
        private Long id;
        private LocalDate planDate;
        private String futureVisionUrl;
        private String identity1;
        private String identity2;
        private String identity3;
        private String motivation1;
        private String motivation2;
        private String motivation3;
        private String gratitude1;
        private String gratitude2;
        private String gratitude3;
        private String firstTask;
        private String feedbackStart;
        private String feedbackMid;
        private String feedbackEnd;

        public static Response from(DailyPlan plan) {
            return Response.builder()
                    .id(plan.getId())
                    .planDate(plan.getPlanDate())
                    .futureVisionUrl(plan.getFutureVisionUrl())
                    .identity1(plan.getIdentity1())
                    .identity2(plan.getIdentity2())
                    .identity3(plan.getIdentity3())
                    .motivation1(plan.getMotivation1())
                    .motivation2(plan.getMotivation2())
                    .motivation3(plan.getMotivation3())
                    .gratitude1(plan.getGratitude1())
                    .gratitude2(plan.getGratitude2())
                    .gratitude3(plan.getGratitude3())
                    .firstTask(plan.getFirstTask())
                    .feedbackStart(plan.getFeedbackStart())
                    .feedbackMid(plan.getFeedbackMid())
                    .feedbackEnd(plan.getFeedbackEnd())
                    .build();
        }
    }
}
