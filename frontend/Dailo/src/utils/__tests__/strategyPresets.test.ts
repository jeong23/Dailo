import { recommendPreset, splitContribution } from '../strategyPresets';

const accounts = [
  { id: 1, type: 'PENSION', targetPct: 52 },
  { id: 2, type: 'IRP', targetPct: 16 },
  { id: 3, type: 'ISA', targetPct: 32 },
];
const sum = (r: Record<number, number>) => Object.values(r).reduce((s, v) => s + v, 0);

describe('recommendPreset', () => {
  it('5년 안에 큰돈 + 출금 자유 → 유동성 우선', () => {
    expect(recommendPreset({ bigSpendIn5y: true, preferTaxCredit: false, sellWhenLosing: false }))
      .toEqual({ preset: 'LIQUIDITY', allowSell: false });
  });
  it('세액공제 우선', () => {
    expect(recommendPreset({ bigSpendIn5y: true, preferTaxCredit: true, sellWhenLosing: true }).preset).toBe('TAX');
  });
  it('둘 다 아니면 균등', () => {
    expect(recommendPreset({ bigSpendIn5y: false, preferTaxCredit: false, sellWhenLosing: true }).preset).toBe('EQUAL');
  });
});

describe('splitContribution', () => {
  it('유동성 우선은 ISA에 전부', () => {
    expect(splitContribution('LIQUIDITY', accounts, 800_000)).toEqual({ 1: 0, 2: 0, 3: 800_000 });
  });
  it('ISA 없으면 일반, 둘 다 없으면 비율대로', () => {
    expect(splitContribution('LIQUIDITY', [{ id: 9, type: 'GENERAL', targetPct: 0 }], 100_000)).toEqual({ 9: 100_000 });
    const r = splitContribution('LIQUIDITY', accounts.slice(0, 2), 100_000);
    expect(sum(r)).toBe(100_000);
  });
  it('세액공제 우선: 연금 50만 → IRP 25만 → ISA', () => {
    expect(splitContribution('TAX', accounts, 1_000_000)).toEqual({ 1: 500_000, 2: 250_000, 3: 250_000 });
    expect(splitContribution('TAX', accounts, 300_000)).toEqual({ 1: 300_000, 2: 0, 3: 0 });
  });
  it('세액공제 우선: 연봉 기준 추천액이 있으면 그만큼만 (IRP 8.4만), 나머지 ISA', () => {
    expect(splitContribution('TAX', accounts, 800_000, { pensionMonthly: 500_000, irpMonthly: 84_000 }))
      .toEqual({ 1: 500_000, 2: 84_000, 3: 216_000 });
    // 세금이 적어 IRP 불필요(0)면 IRP는 건너뜀
    expect(splitContribution('TAX', accounts, 800_000, { pensionMonthly: 300_000, irpMonthly: 0 }))
      .toEqual({ 1: 300_000, 2: 0, 3: 500_000 });
  });
  it('세액공제 우선인데 연금 계좌뿐이면 넘는 돈도 납입', () => {
    expect(sum(splitContribution('TAX', [{ id: 1, type: 'PENSION', targetPct: 100 }], 700_000))).toBe(700_000);
  });
  it('균등 적립은 비율대로, 합계 유지', () => {
    const r = splitContribution('EQUAL', accounts, 950_000);
    expect(r[2]).toBe(152_000);
    expect(sum(r)).toBe(950_000);
  });
});
