package com.dailo.app.entity;

import jakarta.persistence.*;
import lombok.*;

// 회원별 짧은 메모 (예산 설정 달별 메모 'budget-YYYY-MM', 월간 플래너 메모 'planner-YYYY-MM')
//  예전엔 기기 localStorage라 폰에서 쓴 메모가 PC에 안 보였음 — 키 형식은 MemberNoteService.KEY로 제한
@Entity
@Table(name = "member_note",
        uniqueConstraints = @UniqueConstraint(name = "uq_member_note_key", columnNames = {"member_id", "note_key"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class MemberNote extends BaseEntity {

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(name = "note_key", nullable = false, length = 40)
    private String noteKey;

    @Column(columnDefinition = "TEXT")
    private String content;

    public void update(String content) {
        this.content = content;
    }
}
