import { rebalanceByTheme, TRHolding, TRTheme } from '../themeRebalance';

const themes: TRTheme[] = [
  { id: 1, targetPct: 50, cash: false }, // 미국 지수
  { id: 2, targetPct: 30, cash: false }, // AI
  { id: 3, targetPct: 20, cash: true },  // 현금성
];

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe('rebalanceByTheme', () => {
  it('목표대로면 매도 없이 납입금만 모자란 테마로', () => {
    const holdings: TRHolding[] = [
      { id: 10, accountId: 1, themeId: 1, value: 500_000, price: 25_000 },
      { id: 11, accountId: 1, themeId: 2, value: 300_000, price: 10_000 },
      { id: 12, accountId: 1, themeId: 3, value: 200_000, price: null },
    ];
    const r = rebalanceByTheme(themes, holdings, [{ id: 1, budget: 100_000 }], 5);
    expect(r.actions.some(a => a.side === 'SELL' || a.side === 'USE_CASH')).toBe(false);
    const spent = sum(r.actions.map(a => a.amount));
    expect(spent + r.leftover[1]).toBe(100_000);
    // 납입 후에도 목표에 가깝게: 미국 50 / AI 30 / 현금 20
    r.themes.forEach(t => expect(Math.abs(t.afterPct - t.targetPct)).toBeLessThan(3));
  });

  it('밴드를 넘게 오른 테마를 팔고 그 돈으로 모자란 테마를 산다', () => {
    const holdings: TRHolding[] = [
      { id: 10, accountId: 1, themeId: 1, value: 300_000, price: 25_000 },
      { id: 11, accountId: 1, themeId: 2, value: 600_000, price: 10_000 }, // AI 60% (목표 30)
      { id: 12, accountId: 1, themeId: 3, value: 100_000, price: null },
    ];
    const r = rebalanceByTheme(themes, holdings, [{ id: 1, budget: 0 }], 5);
    const sell = r.actions.find(a => a.side === 'SELL')!;
    expect(sell).toMatchObject({ holdingId: 11, shares: 30, amount: 300_000 });
    expect(r.actions.some(a => a.side === 'BUY' && a.themeId === 2)).toBe(false); // 판 테마는 다시 안 삼
    expect(r.actions.find(a => a.side === 'BUY' && a.themeId === 1)?.amount).toBe(200_000);
    expect(r.actions.find(a => a.side === 'KEEP_CASH')?.amount).toBe(100_000);
  });

  it('돈은 계좌 밖으로 못 나감 — 그 계좌에 있는 종목만 산다', () => {
    const holdings: TRHolding[] = [
      { id: 10, accountId: 1, themeId: 1, value: 0, price: 25_000 },  // 연금: 미국만
      { id: 11, accountId: 2, themeId: 2, value: 0, price: 10_000 },  // ISA: AI만
    ];
    const r = rebalanceByTheme(themes.slice(0, 2), holdings, [{ id: 1, budget: 100_000 }, { id: 2, budget: 50_000 }], 5);
    r.actions.forEach(a => {
      if (a.holdingId === 10) expect(a.accountId).toBe(1);
      if (a.holdingId === 11) expect(a.accountId).toBe(2);
    });
    expect(sum(r.actions.filter(a => a.accountId === 1).map(a => a.amount))).toBeLessThanOrEqual(100_000);
  });

  it('1주가 비싸서 못 쓰는 돈은 남는 돈으로', () => {
    const holdings: TRHolding[] = [{ id: 10, accountId: 1, themeId: 1, value: 0, price: 176_000 }];
    const r = rebalanceByTheme([{ id: 1, targetPct: 100, cash: false }], holdings, [{ id: 1, budget: 400_000 }], 5);
    expect(r.actions[0]).toMatchObject({ side: 'BUY', shares: 2, amount: 352_000 });
    expect(r.leftover[1]).toBe(48_000);
  });

  it('미분류 종목은 계산에서 빠짐', () => {
    const holdings: TRHolding[] = [
      { id: 10, accountId: 1, themeId: 1, value: 100_000, price: 10_000 },
      { id: 99, accountId: 1, themeId: null, value: 9_999_999, price: 10_000 },
    ];
    const r = rebalanceByTheme([{ id: 1, targetPct: 100, cash: false }], holdings, [{ id: 1, budget: 0 }], 5);
    expect(r.themes[0].currentPct).toBe(100);
    expect(r.actions).toHaveLength(0);
  });

  it('선택지가 적은 계좌가 공용 테마를 먼저 채움 (ISA 돈이 남지 않게)', () => {
    const t: TRTheme[] = [{ id: 1, targetPct: 50, cash: false }, { id: 2, targetPct: 50, cash: false }];
    const holdings: TRHolding[] = [
      { id: 10, accountId: 1, themeId: 1, value: 0, price: 10_000 }, // 연금: 미국·원자재 둘 다 가능
      { id: 11, accountId: 1, themeId: 2, value: 0, price: 10_000 },
      { id: 20, accountId: 2, themeId: 2, value: 0, price: 10_000 }, // ISA: 원자재만
    ];
    // 연금 10만 + ISA 10만 → 원자재는 ISA가, 미국은 연금이
    const r = rebalanceByTheme(t, holdings, [{ id: 1, budget: 100_000 }, { id: 2, budget: 100_000 }], 5);
    expect(r.leftover[2]).toBe(0);
    expect(r.leftover[1]).toBe(0);
    expect(r.actions.find(a => a.holdingId === 20)?.amount).toBe(100_000);
    expect(r.actions.find(a => a.holdingId === 10)?.amount).toBe(100_000);
  });
});
