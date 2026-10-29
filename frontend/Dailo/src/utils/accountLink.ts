// 예산 분배 항목 ↔ 투자 계좌·적금 자동 연결 — 항목명으로 추정 (IRP를 먼저: 'IRP 연금'이 연금저축에 걸리지 않게)
// 예산 설정에서 연결된 항목이 하나도 없을 때만 제안으로 채움 — 사용자가 한 번이라도 연결을 정하면 그 선택을 따름
// 한 항목은 투자 계좌(investAccountId)나 적금(savingsId) 중 하나에만 연결

const RULES: { type: string; match: RegExp }[] = [
  { type: 'IRP', match: /IRP|퇴직연금/i },
  { type: 'ISA', match: /ISA/i },
  { type: 'PENSION', match: /연금/ },
];

/** 항목명에 맞는 계좌 id (같은 종류가 여러 개면 첫 계좌, 없으면 null) */
export function matchAccount(label: string, accounts: { id: number; type: string }[]): number | null {
  for (const r of RULES) {
    if (!r.match.test(label)) continue;
    return accounts.find(a => a.type === r.type)?.id ?? null;
  }
  return null;
}

const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/** 항목명에 맞는 적금 id — 이름이 서로 포함되면(공백 무시, 2글자 이상), 아니면 '청약' 항목 → 주택청약 */
export function matchSavings(label: string, savings: { id: number; name: string; kind?: string | null }[]): number | null {
  const l = squash(label);
  if (l.length < 2) return null;
  const byName = savings.find(s => { const n = squash(s.name); return n.length >= 2 && (n.includes(l) || l.includes(n)); });
  if (byName) return byName.id;
  if (/청약/.test(label)) return savings.find(s => s.kind === 'HOUSING')?.id ?? null;
  return null;
}

type Linkable = { label: string; investAccountId: number | null; savingsId?: number | null };

/** 연결된 항목이 하나도 없으면 이름으로 자동 연결한 목록, 이미 연결이 있으면 그대로 */
export function suggestLinks<T extends Linkable>(
  items: T[], accounts: { id: number; type: string }[],
  savings: { id: number; name: string; kind?: string | null }[] = [],
): T[] {
  if (accounts.length === 0 && savings.length === 0) return items;
  if (items.some(i => i.investAccountId != null || i.savingsId != null)) return items;
  const usedAcc = new Set<number>();
  const usedSav = new Set<number>();
  return items.map(i => {
    const sid = matchSavings(i.label, savings); // 적금 이름이 더 구체적이라 먼저 ('연금저축'이란 적금은 없음)
    if (sid != null && !usedSav.has(sid)) { usedSav.add(sid); return { ...i, savingsId: sid }; }
    const id = matchAccount(i.label, accounts);
    if (id == null || usedAcc.has(id)) return i; // 한 계좌에 항목 하나만 자동 연결
    usedAcc.add(id);
    return { ...i, investAccountId: id };
  });
}
