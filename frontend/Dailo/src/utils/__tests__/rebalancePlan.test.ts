import { rebalancePlan } from '../rebalance';

const byId = (plan: ReturnType<typeof rebalancePlan>) => Object.fromEntries(plan.map(p => [p.id, p]));

describe('rebalancePlan', () => {
  it('목표대로면 아무것도 안 함', () => {
    const plan = rebalancePlan([{ id: 1, value: 500, weight: 50 }, { id: 2, value: 500, weight: 50 }], 0, 5);
    expect(plan.every(p => p.action === 'HOLD' && p.amount === 0)).toBe(true);
  });

  it('밴드를 넘게 오른 종목을 팔아 모자란 종목을 산다', () => {
    const p = byId(rebalancePlan([{ id: 1, value: 700, weight: 50 }, { id: 2, value: 300, weight: 50 }], 0, 5));
    expect(p[1]).toMatchObject({ action: 'SELL', amount: 200 });
    expect(p[2]).toMatchObject({ action: 'BUY', amount: 200 });
    expect(p[1].afterPct).toBeCloseTo(50);
    expect(p[2].afterPct).toBeCloseTo(50);
  });

  it('가격이 있으면 매도는 주 단위로 내림', () => {
    const p = byId(rebalancePlan([
      { id: 1, value: 700, weight: 50, price: 30 },
      { id: 2, value: 300, weight: 50, price: 10 },
    ], 0, 5));
    expect(p[1]).toMatchObject({ action: 'SELL', amount: 180, shares: 6 });   // 200 → 6주 × 30
    expect(p[2]).toMatchObject({ action: 'BUY', amount: 180, shares: 18 });
  });

  it('밴드 안이면 팔지 않고 납입금으로 모자란 쪽만 채움', () => {
    const p = byId(rebalancePlan([{ id: 1, value: 530, weight: 50 }, { id: 2, value: 470, weight: 50 }], 100, 5));
    expect(p[1].action).not.toBe('SELL');
    expect(p[2]).toMatchObject({ action: 'BUY' });
    expect(p[1].amount + p[2].amount).toBe(100);
  });

  it('매수 합계 = 납입금 + 매도 금액, 판 종목은 다시 사지 않음', () => {
    const plan = rebalancePlan([
      { id: 1, value: 800, weight: 40 },
      { id: 2, value: 150, weight: 30 },
      { id: 3, value: 50, weight: 30 },
    ], 333, 5);
    const sold = plan.filter(p => p.action === 'SELL').reduce((s, p) => s + p.amount, 0);
    const bought = plan.filter(p => p.action === 'BUY').reduce((s, p) => s + p.amount, 0);
    expect(bought).toBe(333 + sold);
    expect(byId(plan)[1].action).toBe('SELL');
  });

  it('평가금액이 없으면 납입금을 목표 비중대로', () => {
    const p = byId(rebalancePlan([{ id: 1, value: 0, weight: 60 }, { id: 2, value: 0, weight: 40 }], 1000, 5));
    expect(p[1].amount).toBe(600);
    expect(p[2].amount).toBe(400);
  });
});
