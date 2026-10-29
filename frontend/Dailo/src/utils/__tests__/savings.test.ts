import { addMonths, paidCount, savingsSummary } from '../savings';

const base = { monthlyAmount: 300_000, startDate: '2026-01-25', months: 12, ratePct: 4.5, taxFree: false };

describe('savings', () => {
  it('말일 보정', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-25', 12)).toBe('2027-01-25');
  });

  it('납입 회차는 오늘까지 지난 납입일 수', () => {
    expect(paidCount(base, '2026-01-24')).toBe(0);
    expect(paidCount(base, '2026-01-25')).toBe(1);
    expect(paidCount(base, '2026-10-28')).toBe(10);   // 1/25 ~ 10/25
    expect(paidCount(base, '2030-01-01')).toBe(12);
    expect(paidCount({ ...base, paidOverride: 7 }, '2026-10-28')).toBe(7);
  });

  it('단리 이자와 세후 만기 수령액', () => {
    const s = savingsSummary(base, '2026-10-28');
    // 300,000 × 0.045 × 78 / 12 = 87,750
    expect(s.grossInterest).toBe(87_750);
    expect(s.netInterest).toBe(87_750 - 13_510);       // 15.4% = 13,513.5 → 10원 절사 13,510
    expect(s.maturityAmount).toBe(3_600_000 + 74_240);
    expect(s.principal).toBe(3_000_000);
    expect(s.maturityDate).toBe('2027-01-25');
    expect(s.nextPayment).toBe('2026-11-25');
    expect(s.status).toBe('ACTIVE');
  });

  it('비과세면 세금 없음, 만기 지나면 MATURED', () => {
    const s = savingsSummary({ ...base, taxFree: true }, '2027-02-01');
    expect(s.netInterest).toBe(87_750);
    expect(s.status).toBe('MATURED');
    expect(s.nextPayment).toBeNull();
  });

  it('정부기여금 — 직접 입력한 적립액 우선, 만기에 월 기여금 × 기간 더함', () => {
    const mirae = { monthlyAmount: 500_000, startDate: '2026-07-27', months: 36, ratePct: 6, taxFree: true, monthlyBonus: 60_000 };
    const auto = savingsSummary(mirae, '2026-10-29');
    expect(auto.paid).toBe(4);
    expect(auto.bonusNow).toBe(240_000);
    expect(auto.current).toBe(2_000_000 + 240_000);
    const s = savingsSummary({ ...mirae, bonusBalance: 180_000 }, '2026-10-29');
    expect(s.bonusNow).toBe(180_000);
    expect(s.bonusTotal).toBe(2_160_000);
    // 500,000 × 0.06 × 666 / 12 = 1,665,000 (비과세)
    expect(s.maturityAmount).toBe(18_000_000 + 1_665_000 + 2_160_000);
  });
});
