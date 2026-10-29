package com.dailo.app.service;

import com.dailo.app.dto.SavingsDto;
import com.dailo.app.entity.Savings;
import com.dailo.app.repository.SavingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SavingsService {

    private final SavingsRepository savingsRepo;

    private static final Set<String> KINDS = Set.of("SAVINGS", "HOUSING");
    private static final Set<String> REGIONS = Set.of("SEOUL_BUSAN", "METRO", "OTHER");

    public List<SavingsDto.Response> list(Long memberId) {
        return savingsRepo.findByMemberIdOrderByStartDateAsc(memberId).stream().map(SavingsDto.Response::from).toList();
    }

    @Transactional
    public SavingsDto.Response create(Long memberId, SavingsDto.Request req) {
        validate(req);
        boolean housing = isHousing(req);
        Savings s = savingsRepo.save(Savings.builder()
                .memberId(memberId).name(req.getName().trim()).bank(blankToNull(req.getBank()))
                .monthlyAmount(req.getMonthlyAmount()).startDate(req.getStartDate()).months(housing ? 0 : req.getMonths())
                .ratePct(req.getRatePct() != null ? req.getRatePct() : 0f).taxFree(!housing && Boolean.TRUE.equals(req.getTaxFree()))
                .paidOverride(req.getPaidOverride()).memo(blankToNull(req.getMemo()))
                .kind(housing ? "HOUSING" : "SAVINGS")
                .balanceOverride(housing ? req.getBalanceOverride() : null)
                .region(housing ? req.getRegion() : null)
                .householdHead(housing && Boolean.TRUE.equals(req.getHouseholdHead()))
                .monthlyBonus(housing ? null : req.getMonthlyBonus())
                .bonusBalance(housing ? null : req.getBonusBalance())
                .build());
        return SavingsDto.Response.from(s);
    }

    @Transactional
    public SavingsDto.Response update(Long memberId, Long id, SavingsDto.Request req) {
        validate(req);
        Savings s = owned(memberId, id);
        boolean housing = isHousing(req);
        s.update(req.getName().trim(), blankToNull(req.getBank()), req.getMonthlyAmount(), req.getStartDate(), housing ? 0 : req.getMonths(),
                req.getRatePct() != null ? req.getRatePct() : 0f, !housing && Boolean.TRUE.equals(req.getTaxFree()),
                req.getPaidOverride(), blankToNull(req.getMemo()),
                housing ? "HOUSING" : "SAVINGS", housing ? req.getBalanceOverride() : null,
                housing ? req.getRegion() : null, housing && Boolean.TRUE.equals(req.getHouseholdHead()),
                housing ? null : req.getMonthlyBonus(), housing ? null : req.getBonusBalance());
        return SavingsDto.Response.from(s);
    }

    @Transactional
    public void delete(Long memberId, Long id) {
        savingsRepo.delete(owned(memberId, id));
    }

    private Savings owned(Long memberId, Long id) {
        return savingsRepo.findById(id)
                .filter(s -> s.getMemberId().equals(memberId))
                .orElseThrow(() -> new IllegalArgumentException("적금을 찾을 수 없습니다: " + id));
    }

    private static boolean isHousing(SavingsDto.Request r) {
        return "HOUSING".equals(r.getKind());
    }

    static void validate(SavingsDto.Request r) {
        if (r.getKind() != null && !KINDS.contains(r.getKind())) throw new IllegalArgumentException("종류는 SAVINGS 또는 HOUSING이에요");
        if (r.getName() == null || r.getName().isBlank()) throw new IllegalArgumentException("적금 이름을 입력해주세요");
        if (r.getMonthlyAmount() == null || r.getMonthlyAmount() <= 0) throw new IllegalArgumentException("월 납입액을 입력해주세요");
        if (r.getStartDate() == null) throw new IllegalArgumentException("시작일을 입력해주세요");
        if (r.getRatePct() != null && (r.getRatePct() < 0 || r.getRatePct() > 30)) throw new IllegalArgumentException("이율은 0~30% 사이여야 해요");
        if ((r.getMonthlyBonus() != null && r.getMonthlyBonus() < 0) || (r.getBonusBalance() != null && r.getBonusBalance() < 0)) {
            throw new IllegalArgumentException("정부기여금은 0 이상이어야 해요");
        }
        if (isHousing(r)) {
            // 청약은 만기 없음 — 회차 상한은 50년치로만 막음
            if (r.getPaidOverride() != null && (r.getPaidOverride() < 0 || r.getPaidOverride() > 600)) {
                throw new IllegalArgumentException("납입 회차는 0~600 사이여야 해요");
            }
            if (r.getBalanceOverride() != null && r.getBalanceOverride() < 0) throw new IllegalArgumentException("잔액은 0 이상이어야 해요");
            if (r.getRegion() != null && !REGIONS.contains(r.getRegion())) throw new IllegalArgumentException("지역 값이 올바르지 않아요");
            return;
        }
        if (r.getMonths() == null || r.getMonths() < 1 || r.getMonths() > 120) throw new IllegalArgumentException("기간은 1~120개월이에요");
        if (r.getPaidOverride() != null && (r.getPaidOverride() < 0 || r.getPaidOverride() > r.getMonths())) {
            throw new IllegalArgumentException("납입 회차는 0~" + r.getMonths() + " 사이여야 해요");
        }
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
