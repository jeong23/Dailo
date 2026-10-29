import { checkGoal, isSafeHolding, monthsUntil, riskCap } from '../goalRisk';

const today = new Date(2026, 9, 29); // 2026-10-29

describe('monthsUntil', () => {
  it('남은 개월', () => {
    expect(monthsUntil('2026-10', today)).toBe(0);
    expect(monthsUntil('2028-04', today)).toBe(18);
    expect(monthsUntil('2026-01', today)).toBe(-9);
  });
  it('형식 틀리면 null', () => {
    expect(monthsUntil('2028-13', today)).toBeNull();
    expect(monthsUntil(null, today)).toBeNull();
  });
});

describe('riskCap', () => {
  it('3년 넘으면 제한 없음, 가까울수록 낮게', () => {
    expect(riskCap(40)).toBeNull();
    expect(riskCap(30)).toBe(60);
    expect(riskCap(18)).toBe(40);
    expect(riskCap(6)).toBe(20);
    expect(riskCap(-1)).toBe(20);
  });
});

describe('isSafeHolding', () => {
  it('채권·MMF 이름, 금액 줄, 현금성 테마는 안전자산', () => {
    expect(isSafeHolding({ ticker: 'KODEX 단기채권PLUS', stockCode: '214980' })).toBe(true);
    expect(isSafeHolding({ ticker: '현금잔고(예수금)', manualValue: 1000 })).toBe(true);
    expect(isSafeHolding({ ticker: 'TIGER 미국S&P500', stockCode: '360750' }, true)).toBe(true);
    expect(isSafeHolding({ ticker: 'KODEX 반도체', stockCode: '091160' })).toBe(false);
  });
});

describe('checkGoal', () => {
  const holdings = [{ value: 900, safe: false }, { value: 100, safe: true }];
  it('18개월 남은 주택 자금인데 위험자산 90% → 초과', () => {
    expect(checkGoal('HOUSE', '2028-04', holdings, today)).toEqual({ months: 18, cap: 40, riskyPct: 90, over: true });
  });
  it('노후 목적·날짜 없음·평가금액 0이면 점검 안 함', () => {
    expect(checkGoal('RETIRE', '2028-04', holdings, today)).toBeNull();
    expect(checkGoal('HOUSE', null, holdings, today)).toBeNull();
    expect(checkGoal('HOUSE', '2028-04', [], today)).toBeNull();
  });
  it('3년 넘게 남으면 제한 없음', () => {
    expect(checkGoal('WEDDING', '2030-01', holdings, today)?.over).toBe(false);
  });
});
