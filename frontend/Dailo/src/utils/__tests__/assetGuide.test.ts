import { assetGuide, GuideBucket, GuideTheme } from '../assetGuide';

const buckets = (cash: number, invest: number, savings: number, home = 0): GuideBucket[] => [
  { key: 'c', name: '현금', kind: 'CASH', amount: cash, targetPct: 30 },
  { key: 'i', name: '투자', kind: 'INVEST', amount: invest, targetPct: 40 },
  { key: 's', name: '적금', kind: 'SAVINGS', amount: savings, targetPct: 20 },
  { key: 'h', name: '부동산', kind: 'MANUAL', amount: home, targetPct: 10 },
];

describe('assetGuide — 칸 사이 이동', () => {
  it('현금이 넘치고 투자가 모자라면 현금 → 투자 (만원 단위)', () => {
    const g = assetGuide(buckets(6_000_000, 2_000_000, 2_000_000, 0).slice(0, 3).map(b => ({ ...b, targetPct: b.kind === 'CASH' ? 30 : b.kind === 'INVEST' ? 50 : 20 })), []);
    // 전체 1,000만: 현금 목표 300만(600만 → 300만 넘침), 투자 목표 500만(300만 모자람)
    expect(g.transfers).toEqual([expect.objectContaining({ from: 'c', to: 'i', amount: 3_000_000, redirect: false })]);
    expect(g.stuck).toEqual([]);
  });

  it('부동산(직접 입력)은 옮기는 대상이 아니라 안내로만', () => {
    const g = assetGuide(buckets(3_000_000, 4_000_000, 2_000_000, 0), []);
    // 부동산 목표 100만 부족 — 받을 수 없는 칸이라 stuck
    expect(g.transfers.some(t => t.to === 'h')).toBe(false);
    expect(g.stuck.find(s => s.key === 'h')?.gap).toBeGreaterThan(0);
  });

  it('밴드 안이면 할 일 없음', () => {
    const g = assetGuide(buckets(3_050_000, 3_950_000, 2_000_000, 1_000_000), []);
    expect(g.balanced).toBe(true);
  });

  it('매도 안 함이면 투자에서 빼는 건 새 납입금 돌리기로', () => {
    const g = assetGuide([
      { key: 'c', name: '현금', kind: 'CASH', amount: 1_000_000, targetPct: 50 },
      { key: 'i', name: '투자', kind: 'INVEST', amount: 9_000_000, targetPct: 50 },
    ], [], { allowSell: false });
    expect(g.transfers[0]).toEqual(expect.objectContaining({ from: 'i', to: 'c', redirect: true }));
  });

  it('적금이 모자라면 월 납입 늘리기로 표시', () => {
    const g = assetGuide(buckets(5_000_000, 4_000_000, 0, 1_000_000), []);
    expect(g.transfers.find(t => t.to === 's')?.toSavings).toBe(true);
  });
});

describe('assetGuide — 투자 안 테마', () => {
  const themes: GuideTheme[] = [
    { id: 1, name: '코어 지수', value: 2_000_000, targetPct: 50, cash: false },
    { id: 2, name: '성장 테마', value: 2_000_000, targetPct: 20, cash: false },
    { id: 3, name: '채권', value: 0, targetPct: 30, cash: false },
  ];
  it('옮긴 뒤 투자 금액 기준으로 테마별 매수·줄이기', () => {
    const g = assetGuide([
      { key: 'c', name: '현금', kind: 'CASH', amount: 6_000_000, targetPct: 50 },
      { key: 'i', name: '투자', kind: 'INVEST', amount: 4_000_000, targetPct: 50 },
    ], themes);
    expect(g.investAfter).toBe(5_000_000); // 현금 100만 → 투자
    const byName = Object.fromEntries(g.themeSteps.map(s => [s.name, s]));
    expect(byName['채권']).toEqual(expect.objectContaining({ action: 'BUY', gap: 1_500_000 }));
    expect(byName['성장 테마']).toEqual(expect.objectContaining({ action: 'TRIM', gap: -1_000_000 }));
    expect(byName['코어 지수']).toEqual(expect.objectContaining({ action: 'BUY', gap: 500_000 }));
  });
  it('매도 안 함이면 넘친 테마는 추가 매수 멈춤', () => {
    const g = assetGuide([{ key: 'i', name: '투자', kind: 'INVEST', amount: 4_000_000, targetPct: 100 }], themes, { allowSell: false });
    expect(g.themeSteps.find(s => s.name === '성장 테마')?.action).toBe('HOLD_BUY');
  });
  it('매도 안 함이면 매수 합계를 들어오는 돈에 맞춤', () => {
    const g = assetGuide([
      { key: 'c', name: '현금', kind: 'CASH', amount: 6_000_000, targetPct: 50 },
      { key: 'i', name: '투자', kind: 'INVEST', amount: 4_000_000, targetPct: 50 },
    ], themes, { allowSell: false });
    const buys = g.themeSteps.filter(s => s.action === 'BUY').reduce((t, s) => t + s.gap, 0);
    expect(buys).toBeLessThanOrEqual(1_000_000); // 현금에서 들어온 100만
    expect(buys).toBeGreaterThan(900_000);
  });
});

describe('assetGuide — 위성 테마', () => {
  const themes: GuideTheme[] = [
    { id: 1, name: '코어 지수', value: 3_000_000, targetPct: 40, cash: false },
    { id: 2, name: '성장 테마', value: 0, targetPct: 20, cash: false, satellite: true },
    { id: 3, name: '채권', value: 1_000_000, targetPct: 40, cash: false },
  ];
  const invest = [{ key: 'i', name: '투자', kind: 'INVEST' as const, amount: 4_000_000, targetPct: 100 }];

  it('상한 아래인 위성은 사라고 안 하고, 코어끼리 전체를 나눔', () => {
    const g = assetGuide(invest, themes);
    expect(g.themeSteps.some(s => s.name === '성장 테마')).toBe(false);
    // 코어 1:1로 400만 → 각 200만: 코어 100만 넘침, 채권 100만 부족
    expect(g.themeSteps.find(s => s.name === '채권')).toEqual(expect.objectContaining({ action: 'BUY', gap: 1_000_000 }));
  });

  it('상한을 넘은 위성은 줄이기 / 매도 안 함이면 추가 매수 멈춤', () => {
    const over = themes.map(t => (t.id === 2 ? { ...t, value: 2_000_000 } : t));
    const inv = [{ ...invest[0], amount: 6_000_000 }];
    expect(assetGuide(inv, over).themeSteps.find(s => s.satellite)?.action).toBe('TRIM');
    expect(assetGuide(inv, over, { allowSell: false }).themeSteps.find(s => s.satellite)?.action).toBe('HOLD_BUY');
  });
});
