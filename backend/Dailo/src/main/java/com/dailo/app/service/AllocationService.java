package com.dailo.app.service;

import com.dailo.app.dto.InvestDto;
import com.dailo.app.entity.AssetBucket;
import com.dailo.app.entity.InvestTheme;
import com.dailo.app.repository.AssetBucketRepository;
import com.dailo.app.repository.InvestHoldingRepository;
import com.dailo.app.repository.InvestThemeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * 자산 배분 설정 — 투자 테마(투자 자산 안의 비중)와 전체 자산 칸(현금·투자·부동산·적금).
 * 둘 다 "목록 통째로 저장" 방식: 요청에 없는 기존 항목은 삭제, id는 본인 것만.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AllocationService {

    private static final Set<String> KINDS = Set.of("CASH", "INVEST", "SAVINGS", "MANUAL");

    private final InvestThemeRepository themeRepo;
    private final InvestHoldingRepository holdingRepo;
    private final AssetBucketRepository bucketRepo;

    // ─── 투자 테마 ─────────────────────────────────────────────

    public List<InvestDto.ThemeDto> getThemes(Long memberId) {
        return themeRepo.findByMemberIdOrderBySortOrderAsc(memberId).stream().map(InvestDto.ThemeDto::from).toList();
    }

    @Transactional
    public List<InvestDto.ThemeDto> saveThemes(Long memberId, List<InvestDto.ThemeDto> reqs) {
        validatePercent(reqs.stream().map(InvestDto.ThemeDto::getTargetPct).toList(), "테마");
        Set<Long> kept = new HashSet<>();
        int order = 0;
        for (InvestDto.ThemeDto r : reqs) {
            String name = r.getName() == null ? "" : r.getName().trim();
            if (name.isEmpty()) throw new IllegalArgumentException("테마 이름을 입력해주세요");
            boolean cash = Boolean.TRUE.equals(r.getCash());
            InvestTheme theme;
            if (r.getId() != null) {
                theme = themeRepo.findById(r.getId())
                        .filter(t -> t.getMemberId().equals(memberId))
                        .orElseThrow(() -> new IllegalArgumentException("테마를 찾을 수 없습니다: " + r.getId()));
                theme.update(name, r.getTargetPct(), cash, order);
            } else {
                theme = themeRepo.save(InvestTheme.builder()
                        .memberId(memberId).name(name).targetPct(r.getTargetPct()).cash(cash).sortOrder(order)
                        .build());
            }
            kept.add(theme.getId());
            order++;
        }
        // 지운 테마에 속했던 종목은 미분류로
        for (InvestTheme t : themeRepo.findByMemberIdOrderBySortOrderAsc(memberId)) {
            if (kept.contains(t.getId())) continue;
            holdingRepo.clearTheme(t.getId());
            themeRepo.delete(t);
        }
        return getThemes(memberId);
    }

    // ─── 전체 자산 칸 ──────────────────────────────────────────

    /** 처음 열면 현금·투자·부동산·적금 25%씩으로 시작 */
    @Transactional
    public List<InvestDto.BucketDto> getBuckets(Long memberId) {
        List<AssetBucket> buckets = bucketRepo.findByMemberIdOrderBySortOrderAsc(memberId);
        if (buckets.isEmpty()) {
            String[][] defaults = {{"현금", "CASH"}, {"투자", "INVEST"}, {"부동산", "MANUAL"}, {"적금", "SAVINGS"}};
            for (int i = 0; i < defaults.length; i++) {
                bucketRepo.save(AssetBucket.builder().memberId(memberId).name(defaults[i][0]).kind(defaults[i][1])
                        .targetPct(25f).manualAmount(null).sortOrder(i).build());
            }
            buckets = bucketRepo.findByMemberIdOrderBySortOrderAsc(memberId);
        }
        // 적금 페이지 생기기 전에 만든 '적금' 칸(직접 입력, 금액 없음)은 적금 연동으로 전환
        buckets.stream()
                .filter(b -> "MANUAL".equals(b.getKind()) && "적금".equals(b.getName()) && b.getManualAmount() == null)
                .forEach(b -> b.update(b.getName(), "SAVINGS", b.getTargetPct(), null, b.getSortOrder()));
        return buckets.stream().map(InvestDto.BucketDto::from).toList();
    }

    @Transactional
    public List<InvestDto.BucketDto> saveBuckets(Long memberId, List<InvestDto.BucketDto> reqs) {
        if (reqs.isEmpty()) throw new IllegalArgumentException("자산 칸이 하나 이상 있어야 해요");
        validatePercent(reqs.stream().map(InvestDto.BucketDto::getTargetPct).toList(), "자산");
        Set<Long> kept = new HashSet<>();
        int order = 0;
        for (InvestDto.BucketDto r : reqs) {
            String name = r.getName() == null ? "" : r.getName().trim();
            if (name.isEmpty()) throw new IllegalArgumentException("자산 이름을 입력해주세요");
            String kind = r.getKind() == null ? "MANUAL" : r.getKind().toUpperCase();
            if (!KINDS.contains(kind)) throw new IllegalArgumentException("알 수 없는 자산 종류: " + r.getKind());
            Long amount = "MANUAL".equals(kind) && r.getManualAmount() != null && r.getManualAmount() >= 0 ? r.getManualAmount() : null;
            AssetBucket bucket;
            if (r.getId() != null) {
                bucket = bucketRepo.findById(r.getId())
                        .filter(b -> b.getMemberId().equals(memberId))
                        .orElseThrow(() -> new IllegalArgumentException("자산 칸을 찾을 수 없습니다: " + r.getId()));
                bucket.update(name, kind, r.getTargetPct(), amount, order);
            } else {
                bucket = bucketRepo.save(AssetBucket.builder().memberId(memberId).name(name).kind(kind)
                        .targetPct(r.getTargetPct()).manualAmount(amount).sortOrder(order).build());
            }
            kept.add(bucket.getId());
            order++;
        }
        bucketRepo.findByMemberIdOrderBySortOrderAsc(memberId).stream()
                .filter(b -> !kept.contains(b.getId()))
                .forEach(bucketRepo::delete);
        return getBuckets(memberId);
    }

    // 비율: 각각 0~100, 항목이 있으면 합계 100 (±0.1)
    static void validatePercent(List<Float> pcts, String label) {
        double sum = 0;
        for (Float p : pcts) {
            if (p == null || p < 0 || p > 100) throw new IllegalArgumentException(label + " 비중은 0~100% 사이여야 해요");
            sum += p;
        }
        if (!pcts.isEmpty() && Math.abs(sum - 100) > 0.1) {
            throw new IllegalArgumentException(label + " 비중 합계가 " + Math.round(sum * 10) / 10.0 + "%예요 (100%여야 해요)");
        }
    }
}
