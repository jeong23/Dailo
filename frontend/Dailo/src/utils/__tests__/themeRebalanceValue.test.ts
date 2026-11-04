import { rebalanceByTheme, TRHolding, TRTheme } from '../themeRebalance';

// style='VALUE' — 손해 큰 종목 우선 매수 + 수익 실현
const themes: TRTheme[] = [{ id: 1, targetPct: 100, cash: false }];
const opts = { style: 'VALUE' as const, profitTake: 5 };
const bought = (r: ReturnType<typeof rebalanceByTheme>, id: number) =>
  r.actions.filter(a => a.side === 'BUY' && a.holdingId === id).reduce((t, a) => t + (a.shares ?? 0), 0);

describe('rebalanceByTheme VALUE 스타일', () => {
  it('손해가 큰 종목부터 사고, 평균단가가 내려가면 다음 종목으로 넘어간다', () => {
    const holdings: TRHolding[] = [
      { id: 1, accountId: 1, themeId: 1, value: 100_000, price: 10_000, shares: 10, cost: 125_000 }, // -20%
      { id: 2, accountId: 1, themeId: 1, value: 100_000, price: 10_000, shares: 10, cost: 111_112 }, // 약 -10%
    ];
    const r = rebalanceByTheme(themes, holdings, [{ id: 1, budget: 200_000 }], 5, opts);
    const a = bought(r, 1);
    const b = bought(r, 2);
    expect(a + b).toBe(20);
    expect(a).toBeGreaterThan(b); // 더 많이 떨어진 쪽에 더 많이
    expect(b).toBeGreaterThan(0); // 평단이 따라 내려오면 덜 떨어진 종목도 차례가 옴
  });

  it('돈이 적으면 가장 많이 떨어진 종목만 산다', () => {
    const holdings: TRHolding[] = [
      { id: 1, accountId: 1, themeId: 1, value: 100_000, price: 10_000, shares: 10, cost: 125_000 }, // -20%
      { id: 2, accountId: 1, themeId: 1, value: 100_000, price: 10_000, shares: 10, cost: 111_112 },
    ];
    const r = rebalanceByTheme(themes, holdings, [{ id: 1, budget: 50_000 }], 5, opts);
    expect(bought(r, 1)).toBe(5);
    expect(bought(r, 2)).toBe(0);
  });

  it('보유 0주 종목은 손익 0으로 — 손해 중인 종목 다음, 수익 중인 종목보다 먼저', () => {
    const holdings: TRHolding[] = [
      { id: 1, accountId: 1, themeId: 1, value: 104_000, price: 10_400, shares: 10, cost: 100_000 }, // +4% (실현 기준 아래)
      { id: 2, accountId: 1, themeId: 1, value: 0, price: 10_000, shares: 0, cost: 0 },
      { id: 3, accountId: 1, themeId: 1, value: 95_000, price: 9_500, shares: 10, cost: 100_000 }, // -5%
    ];
    const r = rebalanceByTheme(themes, holdings, [{ id: 1, budget: 9_500 }], 5, opts);
    expect(bought(r, 3)).toBe(1);
    const r2 = rebalanceByTheme(themes, holdings.filter(h => h.id !== 3), [{ id: 1, budget: 10_000 }], 5, opts);
    expect(bought(r2, 2)).toBe(1);
    expect(r.actions.some(x => x.side === 'SELL')).toBe(false);
  });

  it('수익률이 기준 이상이면 수익 난 만큼만 팔고, 그 돈으로 떨어진 종목을 산다', () => {
    const holdings: TRHolding[] = [
      { id: 1, accountId: 1, themeId: 1, value: 120_000, price: 10_000, shares: 12, cost: 100_000 }, // +20%
      { id: 2, accountId: 1, themeId: 1, value: 80_000, price: 10_000, shares: 8, cost: 100_000 },   // -20%
    ];
    const r = rebalanceByTheme(themes, holdings, [{ id: 1, budget: 0 }], 5, opts);
    expect(r.actions.find(a => a.side === 'SELL')).toMatchObject({ holdingId: 1, shares: 2, amount: 20_000 }); // 원금 10만은 남김
    expect(bought(r, 2)).toBe(2);
    expect(bought(r, 1)).toBe(0); // 수익 실현한 종목은 같은 달 다시 안 삼
  });

  it('기준 아래 수익이나 profitTake 0이면 팔지 않는다 — allowSell(sell=false)과도 무관', () => {
    const holdings: TRHolding[] = [
      { id: 1, accountId: 1, themeId: 1, value: 120_000, price: 10_000, shares: 12, cost: 100_000 }, // +20%
    ];
    expect(rebalanceByTheme(themes, holdings, [{ id: 1, budget: 0 }], 5, { ...opts, profitTake: 0 }).actions).toHaveLength(0);
    expect(rebalanceByTheme(themes, holdings, [{ id: 1, budget: 0 }], 5, { ...opts, profitTake: 25 }).actions).toHaveLength(0);
    expect(rebalanceByTheme(themes, holdings, [{ id: 1, budget: 0 }], 5, { ...opts, sell: false }).actions[0])
      .toMatchObject({ side: 'SELL', shares: 2 });
  });

  it('테마 목표는 그대로 — 손해 큰 종목이라도 목표를 채운 테마는 안 산다', () => {
    const two: TRTheme[] = [{ id: 1, targetPct: 50, cash: false }, { id: 2, targetPct: 50, cash: false }];
    const holdings: TRHolding[] = [
      { id: 1, accountId: 1, themeId: 1, value: 150_000, price: 10_000, shares: 15, cost: 300_000 }, // -50%인데 테마 1은 넘침
      { id: 2, accountId: 1, themeId: 2, value: 50_000, price: 10_000, shares: 5, cost: 50_000 },
    ];
    const r = rebalanceByTheme(two, holdings, [{ id: 1, budget: 100_000 }], 5, opts);
    expect(bought(r, 1)).toBe(0);
    expect(bought(r, 2)).toBe(10);
  });

  it('THEME 스타일(기본)은 손익을 보지 않고 평가금액 작은 종목부터', () => {
    const holdings: TRHolding[] = [
      { id: 1, accountId: 1, themeId: 1, value: 100_000, price: 10_000, shares: 10, cost: 200_000 }, // -50%
      { id: 2, accountId: 1, themeId: 1, value: 50_000, price: 10_000, shares: 5, cost: 40_000 },
    ];
    const r = rebalanceByTheme(themes, holdings, [{ id: 1, budget: 10_000 }], 5);
    expect(bought(r, 2)).toBe(1);
  });
});
