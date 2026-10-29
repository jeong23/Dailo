// 테마 리밸런싱 — 비중은 종목이 아니라 테마(미국 지수·AI·원자재·현금성…)로 맞춘다.
// 돈은 계좌(연금·IRP·ISA)별로 들어오고 계좌 밖으로 못 나가므로, 각 계좌의 돈으로
// "그 계좌에서 살 수 있는 종목" 중 전체 기준으로 가장 모자란 테마를 1주씩 산다.
//
// 1) 매도: 현재 비중이 목표 + threshold(%p)를 넘은 테마만 목표까지 덜어냄 (큰 종목부터, 1주 단위 내림)
//    현금성 테마가 넘치면 그 계좌의 현금성 금액을 '사용'으로 돌림
// 2) 매수: 계좌별 돈(납입금 + 판 돈) → 살 수 있는 테마가 적은 계좌부터, 1주씩 목표 대비 부족 비율이 가장 큰 테마의 종목
//    같은 테마 종목이 여럿이면 평가금액이 작은 쪽부터 (한쪽으로 쏠리지 않게)
//    현금성 테마가 가장 모자라면 1만원 단위로 현금으로 남김
//    목표를 이미 채운 테마는 사지 않음 → 1주 가격이 커서 못 쓴 돈은 '남는 돈'(다음 달로)
// 3) 매도한 테마는 같은 달에 다시 사지 않음

export interface TRTheme { id: number; targetPct: number; cash: boolean }
export interface TRHolding {
  id: number;
  accountId: number;
  themeId: number | null;   // null = 미분류 → 계산 제외
  value: number;            // 평가금액 (현금성은 직접 입력 금액)
  price: number | null;     // 1주 가격 — 현금성/가격 없음은 null
}
export interface TRAccount { id: number; budget: number }

export type TRSide = 'BUY' | 'SELL' | 'USE_CASH' | 'KEEP_CASH';
export interface TRAction {
  side: TRSide;
  accountId: number;
  holdingId: number | null; // KEEP_CASH인데 그 계좌에 현금성 항목이 없으면 null
  themeId: number;
  shares: number | null;
  amount: number;
}
export interface TRThemeResult { id: number; value: number; afterValue: number; currentPct: number; afterPct: number; targetPct: number }
export interface TRResult { actions: TRAction[]; themes: TRThemeResult[]; leftover: Record<number, number> }

const CASH_UNIT = 10_000;

export function rebalanceByTheme(themes: TRTheme[], holdings: TRHolding[], accounts: TRAccount[], threshold: number): TRResult {
  const themeIds = new Set(themes.map(t => t.id));
  const hs = holdings.filter(h => h.themeId !== null && themeIds.has(h.themeId)).map(h => ({ ...h, value: Math.max(h.value, 0) }));
  const totalWeight = themes.reduce((s, t) => s + Math.max(t.targetPct, 0), 0);
  const w = (t: TRTheme) => (totalWeight > 0 ? Math.max(t.targetPct, 0) / totalWeight : 0);

  const cash: Record<number, number> = {};
  accounts.forEach(a => { cash[a.id] = Math.max(Math.floor(a.budget), 0); });

  const valueOf: Record<number, number> = {};
  themes.forEach(t => { valueOf[t.id] = 0; });
  hs.forEach(h => { valueOf[h.themeId!] += h.value; });
  const current = Object.values(valueOf).reduce((s, v) => s + v, 0);
  const total = current + Object.values(cash).reduce((s, v) => s + v, 0);
  const target = (t: TRTheme) => total * w(t);
  const startValue = { ...valueOf };

  const actions: TRAction[] = [];
  const sold = new Set<number>();

  // 1) 밴드를 넘은 테마 덜어내기
  if (current > 0 && totalWeight > 0) {
    for (const t of themes) {
      const pct = (valueOf[t.id] / current) * 100;
      if (pct - w(t) * 100 <= threshold) continue;
      let excess = valueOf[t.id] - target(t);
      if (excess <= 0) continue;
      const members = hs.filter(h => h.themeId === t.id).sort((a, b) => b.value - a.value);
      for (const h of members) {
        if (excess <= 0) break;
        let amount: number;
        let shares: number | null = null;
        if (t.cash || !h.price || h.price <= 0) {
          if (!t.cash) continue; // 가격 모르는 종목은 못 팖
          amount = Math.floor(Math.min(excess, h.value));
        } else {
          shares = Math.min(Math.floor(excess / h.price), Math.floor(h.value / h.price));
          amount = shares * h.price;
        }
        if (amount <= 0) continue;
        actions.push({ side: t.cash ? 'USE_CASH' : 'SELL', accountId: h.accountId, holdingId: h.id, themeId: t.id, shares, amount });
        h.value -= amount;
        valueOf[t.id] -= amount;
        cash[h.accountId] = (cash[h.accountId] ?? 0) + amount;
        excess -= amount;
        sold.add(t.id);
      }
    }
  }

  // 2) 계좌별 1주씩 매수
  const buys = new Map<string, TRAction>();
  const record = (side: TRSide, accountId: number, holdingId: number | null, themeId: number, amount: number, share: boolean) => {
    const key = `${side}:${accountId}:${holdingId}:${themeId}`;
    const a = buys.get(key) ?? { side, accountId, holdingId, themeId, shares: share ? 0 : null, amount: 0 };
    a.amount += amount;
    if (share) a.shares = (a.shares ?? 0) + 1;
    buys.set(key, a);
  };
  const deficitRatio = (t: TRTheme) => { const tv = target(t); return tv > 0 ? (tv - valueOf[t.id]) / tv : -Infinity; };

  // 살 수 있는 테마가 적은 계좌부터 끝까지 — 선택지가 많은 계좌가 공용 테마를 먼저 채워버리면
  // 선택지 적은 계좌(예: ISA는 원자재만)의 돈이 갈 곳 없이 남음
  const buyableThemes = (accId: number) => new Set(hs
    .filter(h => h.accountId === accId && h.themeId !== null && !sold.has(h.themeId)
      && (themes.find(t => t.id === h.themeId)?.cash || (h.price && h.price > 0)))
    .map(h => h.themeId)).size;
  const ordered = [...accounts].sort((a, b) => buyableThemes(a.id) - buyableThemes(b.id));

  for (const acc of ordered) {
    for (let guard = 0; guard < 100_000; guard++) {
      const money = cash[acc.id] ?? 0;
      if (money <= 0) break;
      // 이 계좌에서 살 수 있는 테마 후보: (테마, 1회 단가, 대상 종목)
      let best: { t: TRTheme; unit: number; holding: (typeof hs)[number] | null } | null = null;
      for (const t of themes) {
        if (sold.has(t.id) || deficitRatio(t) <= 0) continue;
        let cand: { unit: number; holding: (typeof hs)[number] | null } | null = null;
        if (t.cash) {
          const unit = Math.min(CASH_UNIT, money, Math.ceil(target(t) - valueOf[t.id]));
          if (unit > 0) cand = { unit, holding: hs.find(h => h.accountId === acc.id && h.themeId === t.id) ?? null };
        } else {
          const pick = hs
            .filter(h => h.accountId === acc.id && h.themeId === t.id && h.price && h.price > 0 && h.price <= money)
            .sort((a, b) => a.value - b.value)[0];
          if (pick) cand = { unit: pick.price!, holding: pick };
        }
        if (cand && (!best || deficitRatio(t) > deficitRatio(best.t))) best = { t, ...cand };
      }
      if (!best) break;
      cash[acc.id] -= best.unit;
      valueOf[best.t.id] += best.unit;
      if (best.holding) best.holding.value += best.unit;
      record(best.t.cash ? 'KEEP_CASH' : 'BUY', acc.id, best.holding?.id ?? null, best.t.id, best.unit, !best.t.cash);
    }
  }
  actions.push(...buys.values());

  return {
    actions,
    themes: themes.map(t => ({
      id: t.id,
      value: startValue[t.id],
      afterValue: valueOf[t.id],
      currentPct: current > 0 ? (startValue[t.id] / current) * 100 : 0,
      afterPct: total > 0 ? (valueOf[t.id] / total) * 100 : 0,
      targetPct: w(t) * 100,
    })),
    leftover: cash,
  };
}
