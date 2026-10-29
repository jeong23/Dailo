import { currentPrincipal, housingSummary } from '../savings';

const base = { monthlyAmount: 100_000, startDate: '2024-09-10', ratePct: 0.5 };

describe('housingSummary', () => {
  it('만기 없이 회차가 계속 늘고, 잔액은 월 납입액 × 회차', () => {
    const s = housingSummary(base, '2026-10-29');
    // 2024-09-10 ~ 2026-10-10 = 26회
    expect(s.paid).toBe(26);
    expect(s.principal).toBe(2_600_000);
    expect(s.joinedMonths).toBe(25);
    expect(s.nextPayment).toBe('2026-11-10');
  });

  it('은행 잔액을 넣으면 그걸 원금으로', () => {
    expect(housingSummary({ ...base, balanceOverride: 3_123_456 }, '2026-10-29').principal).toBe(3_123_456);
  });

  it('청약 인정 금액은 2024-11 전 10만, 이후 25만 한도', () => {
    const s = housingSummary({ ...base, monthlyAmount: 300_000 }, '2024-12-31');
    // 9/10, 10/10 → 10만씩 / 11/10, 12/10 → 25만씩
    expect(s.paid).toBe(4);
    expect(s.recognized).toBe(100_000 * 2 + 250_000 * 2);
    expect(s.overCap).toBe(true);
  });

  it('민영주택 예치금 — 지역별 충족 면적', () => {
    const seoul = housingSummary({ ...base, balanceOverride: 6_500_000, region: 'SEOUL_BUSAN' }, '2026-10-29');
    expect(seoul.tierIdx).toBe(1);              // 600만 ≤ 650만 < 1000만 → 102㎡ 이하
    expect(seoul.nextTier).toBe(10_000_000);
    const other = housingSummary({ ...base, balanceOverride: 6_500_000, region: 'OTHER' }, '2026-10-29');
    expect(other.tierIdx).toBe(3);              // 기타 시·군 500만 → 모든 면적
    expect(other.nextTier).toBeNull();
    expect(housingSummary({ ...base, balanceOverride: 1_000_000 }, '2026-10-29').tierIdx).toBe(-1);
  });

  it('소득공제 — 무주택 세대주만, 연 300만 한도 × 40%', () => {
    const big = { ...base, monthlyAmount: 500_000, startDate: '2026-01-05', householdHead: true };
    const s = housingSummary(big, '2026-10-29');
    expect(s.paidThisYear).toBe(5_000_000);     // 1~10월
    expect(s.expectedThisYear).toBe(6_000_000);
    expect(s.deductionNow).toBe(1_200_000);     // 300만 × 40%
    expect(housingSummary({ ...big, householdHead: false }, '2026-10-29').deductionExpected).toBe(0);
  });

  it('currentPrincipal은 종류에 맞게', () => {
    const today = '2026-10-29';
    expect(currentPrincipal({ ...base, months: 0, taxFree: false, kind: 'HOUSING' }, today)).toBe(2_600_000);
    expect(currentPrincipal({ ...base, startDate: '2026-01-25', months: 12, taxFree: false, kind: 'SAVINGS' }, today)).toBe(1_000_000);
  });
});
