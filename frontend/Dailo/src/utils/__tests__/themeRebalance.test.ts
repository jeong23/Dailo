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

  it('sell=false면 넘친 테마도 팔지 않고 납입금을 모자란 테마에만', () => {
    const holdings: TRHolding[] = [
      { id: 10, accountId: 1, themeId: 1, value: 300_000, price: 25_000 },
      { id: 11, accountId: 1, themeId: 2, value: 600_000, price: 10_000 }, // AI 60% (목표 30)
      { id: 12, accountId: 1, themeId: 3, value: 100_000, price: null },
    ];
    const r = rebalanceByTheme(themes, holdings, [{ id: 1, budget: 200_000 }], 5, { sell: false });
    expect(r.actions.some(a => a.side === 'SELL')).toBe(false);
    expect(r.actions.some(a => a.side === 'BUY' && a.themeId === 2)).toBe(false);
    expect(sum(r.actions.map(a => a.amount)) + r.leftover[1]).toBe(200_000);
  });

  it('accounts에 없는 계좌(꺼진 계좌) 종목은 비중엔 들어가고 매매는 안 함', () => {
    const holdings: TRHolding[] = [
      { id: 10, accountId: 1, themeId: 1, value: 0, price: 10_000 },
      { id: 20, accountId: 2, themeId: 2, value: 900_000, price: 10_000 }, // 꺼진 연금 계좌 — AI 과다
    ];
    const r = rebalanceByTheme(themes, holdings, [{ id: 1, budget: 100_000 }], 5);
    expect(r.actions.some(a => a.accountId === 2)).toBe(false);
    expect(r.themes.find(t => t.id === 2)?.value).toBe(900_000);
    expect(r.actions.every(a => a.accountId === 1 && a.side !== 'SELL')).toBe(true);
  });
});

describe('rebalanceByTheme — 위성 테마(코어-새틀라이트)', () => {
  const themes: TRTheme[] = [
    { id: 1, targetPct: 40, cash: false },               // 코어
    { id: 2, targetPct: 20, cash: false, satellite: true }, // 성장(상한 20%)
    { id: 3, targetPct: 40, cash: false },               // 채권
  ];
  const h = (id: number, themeId: number, value: number, price = 10_000): TRHolding => ({ id, accountId: 1, themeId, value, price });

  it('위성이 상한 아래여도 납입금으로 사지 않음', () => {
    const r = rebalanceByTheme(themes, [h(1, 1, 400_000), h(2, 2, 0), h(3, 3, 400_000)], [{ id: 1, budget: 200_000 }], 5);
    expect(r.actions.some(a => a.themeId === 2)).toBe(false);
  });

  it('위성이 상한 아래면 코어 테마가 나머지를 나눠 납입금을 다 씀', () => {
    // 위성 보유 0 → 코어 1:1로 전체(100만)를 나눔 → 각 50만 목표, 둘 다 10만씩 부족
    const r = rebalanceByTheme(themes, [h(1, 1, 400_000), h(2, 2, 0), h(3, 3, 400_000)], [{ id: 1, budget: 200_000 }], 5);
    expect(r.leftover[1]).toBe(0);
    const bought = (id: number) => r.actions.filter(a => a.themeId === id).reduce((s, a) => s + a.amount, 0);
    expect(bought(1)).toBe(100_000);
    expect(bought(3)).toBe(100_000);
  });

  it('위성이 상한을 넘으면 sell=false에선 그대로, sell=true에선 상한까지 매도', () => {
    const hs = [h(1, 1, 200_000), h(2, 2, 600_000), h(3, 3, 200_000)];
    const keep = rebalanceByTheme(themes, hs, [{ id: 1, budget: 0 }], 5, { sell: false });
    expect(keep.actions.some(a => a.side === 'SELL')).toBe(false);
    const sold = rebalanceByTheme(themes, hs.map(x => ({ ...x })), [{ id: 1, budget: 0 }], 5);
    expect(sold.actions.find(a => a.side === 'SELL')?.themeId).toBe(2);
    expect(sold.actions.some(a => a.side === 'BUY' && a.themeId === 2)).toBe(false);
  });
});

describe('rebalanceByTheme — 매매 비용', () => {
  const themes: TRTheme[] = [{ id: 1, targetPct: 100, cash: false }];
  const one = (price: number): TRHolding[] => [{ id: 1, accountId: 1, themeId: 1, value: 0, price }];

  it('수수료·가격 여유까지 쓸 돈 안에서만 산다', () => {
    // 1주 10,000원 + 수수료 0.015%(2원) + 여유 0.5%(50원) = 10,052원 → 10만원이면 9주 (10주는 100,520원)
    const r = rebalanceByTheme(themes, one(10_000), [{ id: 1, budget: 100_000 }], 5, { feeRate: 0.015, buffer: 0.5 });
    const buy = r.actions.find(a => a.side === 'BUY')!;
    expect(buy.shares).toBe(9);
    expect(buy.amount).toBe(90_000);
    expect(buy.fee).toBe(18);
    expect(r.reserve[1]).toBe(450);
    expect(r.fees).toBe(18);
    expect(buy.amount + buy.fee + r.reserve[1] + r.leftover[1]).toBe(100_000);
  });

  it('비용 0이면 예전과 같음', () => {
    const r = rebalanceByTheme(themes, one(10_000), [{ id: 1, budget: 100_000 }], 5);
    expect(r.actions.find(a => a.side === 'BUY')?.shares).toBe(10);
    expect(r.fees).toBe(0);
  });

  it('매도는 수수료만큼 덜 들어옴', () => {
    const two: TRTheme[] = [{ id: 1, targetPct: 50, cash: false }, { id: 2, targetPct: 50, cash: false }];
    const hs: TRHolding[] = [
      { id: 1, accountId: 1, themeId: 1, value: 900_000, price: 10_000 },
      { id: 2, accountId: 1, themeId: 2, value: 100_000, price: 10_000 },
    ];
    const r = rebalanceByTheme(two, hs, [{ id: 1, budget: 0 }], 5, { feeRate: 0.1 });
    const sell = r.actions.find(a => a.side === 'SELL')!;
    expect(sell.fee).toBe(Math.ceil(sell.amount * 0.001));
    const bought = r.actions.filter(a => a.side === 'BUY').reduce((t, a) => t + a.amount + a.fee, 0);
    expect(bought).toBeLessThanOrEqual(sell.amount - sell.fee);
  });
});

describe('rebalanceByTheme — 예수금(현금성 목표 0%)', () => {
  const themes: TRTheme[] = [
    { id: 1, targetPct: 90, cash: false },
    { id: 2, targetPct: 10, cash: false },
    { id: 3, targetPct: 0, cash: true },
  ];
  it('밴드 안의 작은 예수금도 모자란 테마 매수에 쓰고, 쓴 만큼만 현금 사용으로 표시', () => {
    // 예수금 53,313 = 전체의 약 3.7% (밴드 5% 안) — 금(테마 2) 1주 23,600원
    const hs: TRHolding[] = [
      { id: 1, accountId: 1, themeId: 1, value: 1_300_000, price: 25_000 },
      { id: 2, accountId: 1, themeId: 2, value: 70_000, price: 23_600 },
      { id: 3, accountId: 1, themeId: 3, value: 53_313, price: null },
    ];
    const r = rebalanceByTheme(themes, hs, [{ id: 1, budget: 0 }], 5);
    const buy = r.actions.find(a => a.side === 'BUY')!;
    expect(buy.themeId).toBe(2);
    expect(buy.shares).toBe(2);
    const use = r.actions.find(a => a.side === 'USE_CASH')!;
    expect(use.amount).toBe(47_200);
    expect(r.leftover[1]).toBe(0);
  });
});
