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
// accounts에 없는 계좌(꺼진 계좌)의 종목은 테마 비중에만 들어가고 사고팔지 않음
// 현금성이 목표보다 많으면 밴드와 상관없이 꺼내 씀 (현금은 팔아도 손해가 없고, 예수금에 넣어둔 납입금이 밴드 안이라 놀면 안 됨)
//   → 매수 후 못 쓴 만큼은 '현금 사용'에서 되돌려 예수금에 그대로 둠 (쓴 만큼만 '현금 사용'으로 표시)
// sell=false: 주식 테마는 팔지 않고 납입금으로만 맞춤 (손실 중이라 팔기 싫을 때) — 넘치는 현금성 '사용'은 그대로
// satellite(위성 테마, 코어-새틀라이트): targetPct = 상한. 납입금으로 사지 않고, 상한+threshold 넘으면 매도(sell일 때)만.
//   상한보다 적게 들고 있으면 그 금액만큼만 자리를 차지 — 나머지 코어 테마가 (전체 − 위성 보유분)을 목표 비율대로 나눔
//   (상한 전체를 비워두면 코어가 목표를 다 채운 걸로 보여 납입금이 '남는 돈'이 됨)

// 매매 비용(feeRate %, buffer %): 1주 살 때 가격 + 수수료 + 가격 변동 여유를 쓸 돈에서 뺌 — 여유분은 실제로 안 쓰면 남는 돈
//   (시장가 주문 사이 가격이 조금 올라도 돈이 모자라 주문이 실패하지 않게). 매도는 수수료만큼 덜 들어옴
// 세금: ISA·연금 계좌 안 매매는 지금 과세 없음 — 일반 계좌 매도 세금은 화면(ThemePanels)에서 손익 기준으로 따로 안내

export interface TRTheme { id: number; targetPct: number; cash: boolean; satellite?: boolean }
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
  amount: number;           // 체결 금액(주가 × 주수) — 수수료 제외
  fee: number;              // 예상 수수료
}
export interface TRThemeResult { id: number; value: number; afterValue: number; currentPct: number; afterPct: number; targetPct: number }
export interface TRResult {
  actions: TRAction[]; themes: TRThemeResult[];
  leftover: Record<number, number>; // 계좌별 못 쓴 돈 (1주 가격보다 적게 남은 돈)
  reserve: Record<number, number>;  // 계좌별 가격 변동 여유로 남겨둔 돈
  fees: number;                     // 예상 수수료 합계
}

const CASH_UNIT = 10_000;

export function rebalanceByTheme(
  themes: TRTheme[], holdings: TRHolding[], accounts: TRAccount[], threshold: number,
  { sell = true, feeRate = 0, buffer = 0 }: { sell?: boolean; feeRate?: number; buffer?: number } = {},
): TRResult {
  const feeOf = (amount: number) => Math.ceil((amount * Math.max(feeRate, 0)) / 100);
  const reserveOf = (price: number) => Math.ceil((price * Math.max(buffer, 0)) / 100);
  const costOf = (price: number) => price + feeOf(price) + reserveOf(price); // 1주 사는 데 잡아둘 돈
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
  const startValue = { ...valueOf };
  // 위성 테마가 차지하는 몫 = min(보유, 상한). 코어 테마는 나머지를 자기들끼리 비율대로
  const satHeld = themes.filter(t => t.satellite).reduce((s, t) => s + Math.min(startValue[t.id], total * w(t)), 0);
  const coreWeight = themes.filter(t => !t.satellite).reduce((s, t) => s + w(t), 0);
  const target = (t: TRTheme) => (t.satellite ? total * w(t) : coreWeight > 0 ? ((total - satHeld) * w(t)) / coreWeight : 0);

  const actions: TRAction[] = [];
  const sold = new Set<number>();

  // 1) 밴드를 넘은 테마 덜어내기
  if (current > 0 && totalWeight > 0) {
    for (const t of themes) {
      if (!sell && !t.cash) continue;
      const pct = (valueOf[t.id] / current) * 100;
      if (!t.cash && pct - w(t) * 100 <= threshold) continue;
      let excess = valueOf[t.id] - target(t);
      if (excess <= 0) continue;
      const members = hs.filter(h => h.themeId === t.id).sort((a, b) => b.value - a.value);
      for (const h of members) {
        if (excess <= 0) break;
        if (!(h.accountId in cash)) continue; // 꺼진 계좌 — 비중엔 넣되 매매 안 함
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
        const fee = t.cash ? 0 : feeOf(amount);
        actions.push({ side: t.cash ? 'USE_CASH' : 'SELL', accountId: h.accountId, holdingId: h.id, themeId: t.id, shares, amount, fee });
        h.value -= amount;
        valueOf[t.id] -= amount;
        cash[h.accountId] = (cash[h.accountId] ?? 0) + amount - fee;
        excess -= amount;
        sold.add(t.id);
      }
    }
  }

  // 2) 계좌별 1주씩 매수
  const buys = new Map<string, TRAction>();
  const reserve: Record<number, number> = {};
  const record = (side: TRSide, accountId: number, holdingId: number | null, themeId: number, amount: number, share: boolean) => {
    const key = `${side}:${accountId}:${holdingId}:${themeId}`;
    const a = buys.get(key) ?? { side, accountId, holdingId, themeId, shares: share ? 0 : null, amount: 0, fee: 0 };
    a.amount += amount;
    if (share) {
      a.fee += feeOf(amount);
      reserve[accountId] = (reserve[accountId] ?? 0) + reserveOf(amount);
    }
    if (share) a.shares = (a.shares ?? 0) + 1;
    buys.set(key, a);
  };
  const deficitRatio = (t: TRTheme) => { const tv = target(t); return tv > 0 ? (tv - valueOf[t.id]) / tv : -Infinity; };

  // 살 수 있는 테마가 적은 계좌부터 끝까지 — 선택지가 많은 계좌가 공용 테마를 먼저 채워버리면
  // 선택지 적은 계좌(예: ISA는 원자재만)의 돈이 갈 곳 없이 남음
  const buyableThemes = (accId: number) => new Set(hs
    .filter(h => h.accountId === accId && h.themeId !== null && !sold.has(h.themeId)
      && !themes.find(t => t.id === h.themeId)?.satellite
      && (themes.find(t => t.id === h.themeId)?.cash || (h.price && h.price > 0)))
    .map(h => h.themeId)).size;
  const ordered = [...accounts].sort((a, b) => buyableThemes(a.id) - buyableThemes(b.id));

  for (const acc of ordered) {
    for (let guard = 0; guard < 100_000; guard++) {
      const money = cash[acc.id] ?? 0;
      if (money <= 0) break;
      // 이 계좌에서 살 수 있는 테마 후보: (테마, 1회 단가, 대상 종목)
      let best: { t: TRTheme; unit: number; cost: number; holding: (typeof hs)[number] | null } | null = null;
      for (const t of themes) {
        if (t.satellite || sold.has(t.id) || deficitRatio(t) <= 0) continue;
        let cand: { unit: number; cost: number; holding: (typeof hs)[number] | null } | null = null;
        if (t.cash) {
          const unit = Math.min(CASH_UNIT, money, Math.ceil(target(t) - valueOf[t.id]));
          if (unit > 0) cand = { unit, cost: unit, holding: hs.find(h => h.accountId === acc.id && h.themeId === t.id) ?? null };
        } else {
          const pick = hs
            .filter(h => h.accountId === acc.id && h.themeId === t.id && h.price && h.price > 0 && costOf(h.price) <= money)
            .sort((a, b) => a.value - b.value)[0];
          if (pick) cand = { unit: pick.price!, cost: costOf(pick.price!), holding: pick };
        }
        if (cand && (!best || deficitRatio(t) > deficitRatio(best.t))) best = { t, ...cand };
      }
      if (!best) break;
      cash[acc.id] -= best.cost;
      valueOf[best.t.id] += best.unit;
      if (best.holding) best.holding.value += best.unit;
      record(best.t.cash ? 'KEEP_CASH' : 'BUY', acc.id, best.holding?.id ?? null, best.t.id, best.unit, !best.t.cash);
    }
  }
  // 못 쓴 돈은 꺼낸 현금성에서 되돌림 — 예수금에 그대로 남음
  for (const a of actions) {
    if (a.side !== 'USE_CASH') continue;
    const back = Math.min(cash[a.accountId] ?? 0, a.amount);
    if (back <= 0) continue;
    a.amount -= back;
    cash[a.accountId] -= back;
    valueOf[a.themeId] += back;
    const h = hs.find(x => x.id === a.holdingId);
    if (h) h.value += back;
  }
  const usedActions = actions.filter(a => a.side !== 'USE_CASH' || a.amount > 0);
  actions.length = 0;
  actions.push(...usedActions, ...buys.values());

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
    reserve,
    fees: actions.reduce((t, a) => t + a.fee, 0),
  };
}
