// 한 계좌에 같은 종목코드가 여러 줄이면 한 포지션으로 합친다 (백엔드도 중복 저장을 거부함).
//  남길 줄: 목표 비중이 가장 큰 줄 (같으면 보유 수량 있는 줄) — 이름·id는 그 줄 것
//  목표 비중·보유 수량은 합계, 평균단가는 수량 가중평균(원 단위 반올림)

export interface MergeableHolding {
  id?: number;
  ticker: string;
  targetPct: number;
  stockCode?: string | null;
  shares?: number;
  avgPurchasePrice?: number;
}

export function duplicateCodes(holdings: { stockCode?: string | null }[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  holdings.forEach(h => {
    const c = h.stockCode?.toUpperCase();
    if (!c) return;
    if (seen.has(c)) dup.add(c);
    seen.add(c);
  });
  return [...dup];
}

export function mergeDuplicates<T extends MergeableHolding>(holdings: T[]): T[] {
  const groups = new Map<string, T[]>();
  holdings.forEach(h => {
    const c = h.stockCode?.toUpperCase();
    if (c) groups.set(c, [...(groups.get(c) ?? []), h]);
  });
  const drop = new Set<T>();
  const replace = new Map<T, T>();
  groups.forEach(rows => {
    if (rows.length < 2) return;
    const keep = [...rows].sort((a, b) => (b.targetPct || 0) - (a.targetPct || 0) || (b.shares || 0) - (a.shares || 0))[0];
    const shares = rows.reduce((s, r) => s + (r.shares || 0), 0);
    const priced = rows.filter(r => (r.shares || 0) > 0 && (r.avgPurchasePrice || 0) > 0);
    const pricedShares = priced.reduce((s, r) => s + (r.shares || 0), 0);
    const avg = pricedShares > 0
      ? Math.round(priced.reduce((s, r) => s + (r.avgPurchasePrice || 0) * (r.shares || 0), 0) / pricedShares)
      : keep.avgPurchasePrice;
    replace.set(keep, {
      ...keep,
      targetPct: Math.round(rows.reduce((s, r) => s + (r.targetPct || 0), 0) * 10) / 10,
      shares: shares > 0 ? shares : undefined,
      avgPurchasePrice: avg,
    });
    rows.filter(r => r !== keep).forEach(r => drop.add(r));
  });
  return holdings.filter(h => !drop.has(h)).map(h => replace.get(h) ?? h);
}
