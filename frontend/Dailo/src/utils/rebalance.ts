// 납입금 배분 리밸런싱 — 매도 없이 "이번 달에 넣을 돈"으로 목표 비중에 가깝게 맞춘다.
// 1) 납입 후 총액 기준 목표 금액보다 모자란 종목(부족분)부터 채움
// 2) 납입금이 부족분 합계보다 적으면 부족분 비율대로 나눔
// 3) 부족분을 다 채우고도 남으면 남는 돈은 목표 비중대로 나눔
// 결과는 원 단위 정수, 합계는 항상 budget과 정확히 같다.

export interface AllocInput {
  id: number;
  value: number;            // 현재 평가금액
  weight: number;           // 목표 비중 (%, 합계 100 아니어도 정규화)
  price?: number | null;    // 1주 가격 — 있으면 살 수 있는 주수 계산
}

export interface AllocResult {
  id: number;
  amount: number;           // 이번 달 배분 금액
  shares: number | null;    // amount로 살 수 있는 주수 (소수점 매수 불가 가정)
  afterPct: number;         // 납입 후 비중 (%)
  targetPct: number;        // 정규화된 목표 비중 (%)
}

export function allocateContribution(items: AllocInput[], budget: number): AllocResult[] {
  const totalWeight = items.reduce((s, i) => s + Math.max(i.weight, 0), 0);
  const current = items.reduce((s, i) => s + Math.max(i.value, 0), 0);
  const money = Math.max(Math.floor(budget), 0);
  const after = current + money;
  const w = (i: AllocInput) => (totalWeight > 0 ? Math.max(i.weight, 0) / totalWeight : 0);

  let raw: number[];
  if (money === 0 || totalWeight === 0) {
    raw = items.map(() => 0);
  } else {
    const deficits = items.map(i => Math.max(after * w(i) - Math.max(i.value, 0), 0));
    const deficitSum = deficits.reduce((s, d) => s + d, 0);
    if (deficitSum <= 0) raw = items.map(i => money * w(i));
    else if (deficitSum >= money) raw = deficits.map(d => (money * d) / deficitSum);
    else raw = items.map((i, idx) => deficits[idx] + (money - deficitSum) * w(i));
  }

  // 원 단위 내림 후, 남는 원은 소수점 큰 순서로 1원씩 — 합계를 budget과 정확히 맞춤
  const amounts = raw.map(r => Math.floor(r));
  let rest = (totalWeight > 0 ? money : 0) - amounts.reduce((s, a) => s + a, 0);
  const order = raw.map((r, idx) => ({ idx, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; rest > 0 && order.length > 0; k = (k + 1) % order.length, rest--) amounts[order[k].idx]++;

  return items.map((i, idx) => ({
    id: i.id,
    amount: amounts[idx],
    shares: i.price && i.price > 0 ? Math.floor(amounts[idx] / i.price) : null,
    afterPct: after > 0 ? ((Math.max(i.value, 0) + amounts[idx]) / after) * 100 : w(i) * 100,
    targetPct: w(i) * 100,
  }));
}

/** 납입 후에도 목표보다 threshold(%p) 넘게 무거운 종목 — 매도 리밸런싱 검토 대상 */
export function overweightAfter(results: AllocResult[], threshold: number): AllocResult[] {
  return results.filter(r => r.afterPct - r.targetPct > threshold);
}

// ── 밴드 리밸런싱 (매도 포함) ─────────────────────────────────────────
// 계좌 안에서 목표 비중 ±threshold(%p)를 넘게 무거워진 종목은 목표까지 팔고(오른 종목 차익 실현),
// 판 돈 + 이번 달 납입금으로 목표보다 가벼운 종목을 산다(덜 오른·떨어진 종목 저가 매수) → 선순환.
// 밴드 안이면 팔지 않음 — 조금 어긋날 때마다 사고팔면 수수료·세금만 나감.

export type PlanAction = 'BUY' | 'SELL' | 'HOLD';

export interface PlanItem {
  id: number;
  action: PlanAction;
  amount: number;           // 매수/매도 금액 (원, 매도는 주 단위로 내림한 금액)
  shares: number | null;    // 매수/매도 주수 — 가격 없으면 null
  currentPct: number;       // 계좌 안 현재 비중
  targetPct: number;        // 계좌 안 목표 비중 (정규화)
  afterPct: number;         // 실행 후 비중
}

// 원 단위 내림 후 남는 원을 소수점 큰 순서로 1원씩 — 합계를 money와 정확히 맞춤
const roundToTotal = (raw: number[], money: number): number[] => {
  const amounts = raw.map(r => Math.floor(r));
  let rest = money - amounts.reduce((s, a) => s + a, 0);
  const order = raw.map((r, idx) => ({ idx, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; rest > 0 && order.length > 0; k = (k + 1) % order.length, rest--) amounts[order[k].idx]++;
  return amounts;
};

export function rebalancePlan(items: AllocInput[], budget: number, threshold: number): PlanItem[] {
  const totalWeight = items.reduce((s, i) => s + Math.max(i.weight, 0), 0);
  const w = (i: AllocInput) => (totalWeight > 0 ? Math.max(i.weight, 0) / totalWeight : 0);
  const value = (i: AllocInput) => Math.max(i.value, 0);
  const current = items.reduce((s, i) => s + value(i), 0);
  const money = Math.max(Math.floor(budget), 0);
  const after = current + money;

  // 1) 밴드를 넘게 무거운 종목 → 목표 금액까지 매도 (가격 있으면 주 단위 내림)
  const sells = items.map(i => {
    if (current <= 0 || totalWeight <= 0) return 0;
    if ((value(i) / current) * 100 - w(i) * 100 <= threshold) return 0;
    const excess = value(i) - after * w(i);
    if (excess <= 0) return 0;
    return i.price && i.price > 0 ? Math.floor(excess / i.price) * i.price : Math.floor(excess);
  });

  // 2) 판 돈 + 납입금 → 판 종목을 뺀 나머지 중 목표보다 모자란 종목부터
  const cash = money + sells.reduce((s, a) => s + a, 0);
  const canBuy = items.map((_, idx) => sells[idx] === 0);
  const remain = items.map((i, idx) => value(i) - sells[idx]);
  const deficits = items.map((i, idx) => (canBuy[idx] ? Math.max(after * w(i) - remain[idx], 0) : 0));
  const deficitSum = deficits.reduce((s, d) => s + d, 0);
  const buyWeight = items.reduce((s, i, idx) => s + (canBuy[idx] ? w(i) : 0), 0);
  let raw: number[];
  if (cash <= 0 || totalWeight <= 0) raw = items.map(() => 0);
  else if (deficitSum >= cash) raw = deficits.map(d => (cash * d) / deficitSum);
  else raw = items.map((i, idx) => deficits[idx] + (buyWeight > 0 && canBuy[idx] ? ((cash - deficitSum) * w(i)) / buyWeight : 0));
  const buys = roundToTotal(raw, totalWeight > 0 ? cash : 0);

  return items.map((i, idx) => {
    const action: PlanAction = sells[idx] > 0 ? 'SELL' : buys[idx] > 0 ? 'BUY' : 'HOLD';
    const amount = sells[idx] > 0 ? sells[idx] : buys[idx];
    return {
      id: i.id,
      action,
      amount,
      shares: i.price && i.price > 0 && action !== 'HOLD' ? Math.floor(amount / i.price) : null,
      currentPct: current > 0 ? (value(i) / current) * 100 : 0,
      targetPct: w(i) * 100,
      afterPct: after > 0 ? ((remain[idx] + buys[idx]) / after) * 100 : w(i) * 100,
    };
  });
}
