// 자산 현황 '리밸런싱 가이드' — 칸(현금·투자·적금·직접 입력) 목표 비중에 맞추려면 어디서 어디로 얼마를 옮길지,
// 그리고 투자 칸 안에서는 테마별로 얼마를 더 사고 줄일지 계산한다. 화면에서 문장으로 보여주는 참고용 안내.
//
// 1) 칸별 차이 = 전체 × 목표% − 현재. 밴드(band %p) 안이면 그대로 둠 (테마는 themeBand — 투자 설정 리밸런싱 기준)
// 2) 옮길 수 있는 돈: 넘치는 현금·투자 칸만 (적금은 해지 손해, 직접 입력(부동산 등)은 못 옮김)
//    받는 곳: 모자란 현금·투자·적금 칸 (적금은 '월 납입 늘리기'로 안내). 큰 차이끼리 먼저 짝지음
//    allowSell=false면 투자에서 빼는 건 '팔기' 대신 '새 납입금을 다른 칸으로 돌리기'
// 3) 투자 안: 옮긴 뒤 투자 금액 × 테마 목표% − 테마 현재 → +면 매수, −면 줄이기(allowSell=false면 '추가 매수 멈춤')
//    allowSell=false면 넘친 테마를 안 팔기 때문에 모자란 테마 매수 합계를 이번에 들어오는 돈(inflow)에 맞춰 비례로 줄임
//    (안 그러면 매수 합계가 실제로 쓸 수 있는 돈보다 커짐). 들어오는 돈이 없으면 부족액 그대로 + fromNewMoney 표시
//    위성 테마(satellite): 목표% = 상한. 상한 아래면 안내 안 함(사라고 안 함), 넘으면 TRIM/HOLD_BUY.
//    코어 테마는 (투자 금액 − min(위성 보유, 상한))을 자기들끼리 목표 비율대로 — themeRebalance와 같은 기준

export type GuideKind = 'CASH' | 'INVEST' | 'SAVINGS' | 'MANUAL';
export interface GuideBucket { key: string; name: string; kind: GuideKind; amount: number; targetPct: number }
export interface GuideTheme { id: number; name: string; value: number; targetPct: number; cash: boolean; satellite?: boolean }

export interface Transfer { from: string; to: string; fromName: string; toName: string; amount: number; redirect: boolean; toSavings: boolean }
export interface BucketGap { key: string; name: string; kind: GuideKind; gap: number; state: 'OK' | 'SHORT' | 'OVER' }
export interface ThemeStep { id: number; name: string; cash: boolean; satellite?: boolean; gap: number; action: 'BUY' | 'TRIM' | 'HOLD_BUY'; fromNewMoney?: boolean }
export interface GuideNote { key: string; name: string; kind: GuideKind; gap: number }
export interface AssetGuide {
  total: number;
  gaps: BucketGap[];
  transfers: Transfer[];
  stuck: GuideNote[];          // 옮겨서 맞출 수 없는 차이 (부동산·적금 넘침, 짝이 없는 부족)
  investAfter: number | null;  // 옮긴 뒤 투자 칸 금액 (투자 칸 없으면 null)
  themeSteps: ThemeStep[];
  balanced: boolean;
}

const UNIT = 10_000; // 안내 금액은 만원 단위로 내림 — 1원 단위 지시는 의미 없음
const floorUnit = (n: number) => Math.floor(n / UNIT) * UNIT;
const isSource = (k: GuideKind) => k === 'CASH' || k === 'INVEST';
const isSink = (k: GuideKind) => k !== 'MANUAL';

export function assetGuide(
  buckets: GuideBucket[], themes: GuideTheme[],
  { band = 2, themeBand = band, allowSell = true }: { band?: number; themeBand?: number; allowSell?: boolean } = {},
): AssetGuide {
  const total = buckets.reduce((s, b) => s + Math.max(b.amount, 0), 0);
  const targetSum = buckets.reduce((s, b) => s + Math.max(b.targetPct, 0), 0);
  const empty: AssetGuide = { total, gaps: [], transfers: [], stuck: [], investAfter: null, themeSteps: [], balanced: true };
  if (total <= 0 || targetSum <= 0) return empty;

  const gaps: BucketGap[] = buckets.map(b => {
    const gap = (total * Math.max(b.targetPct, 0)) / targetSum - Math.max(b.amount, 0);
    const within = (Math.abs(gap) / total) * 100 < band;
    return { key: b.key, name: b.name, kind: b.kind, gap: within ? 0 : gap, state: within ? 'OK' : gap > 0 ? 'SHORT' : 'OVER' };
  });

  // 큰 차이부터 짝짓기
  const over = gaps.filter(g => g.state === 'OVER' && isSource(g.kind)).map(g => ({ ...g, left: -g.gap })).sort((a, b) => b.left - a.left);
  const short = gaps.filter(g => g.state === 'SHORT' && isSink(g.kind)).map(g => ({ ...g, left: g.gap })).sort((a, b) => b.left - a.left);
  const transfers: Transfer[] = [];
  for (const s of short) {
    for (const o of over) {
      if (s.left <= 0) break;
      if (o.left <= 0 || o.key === s.key) continue;
      const amount = floorUnit(Math.min(o.left, s.left));
      if (amount <= 0) continue;
      transfers.push({
        from: o.key, to: s.key, fromName: o.name, toName: s.name, amount,
        redirect: o.kind === 'INVEST' && !allowSell, toSavings: s.kind === 'SAVINGS',
      });
      o.left -= amount;
      s.left -= amount;
    }
  }

  // 옮겨서 못 맞추는 차이 — 직접 입력 칸, 적금 넘침, 짝이 남은 부족·넘침 (만원 미만은 무시)
  const stuck: GuideNote[] = [];
  gaps.filter(g => g.state !== 'OK').forEach(g => {
    const rest = g.state === 'SHORT' ? short.find(s => s.key === g.key)?.left ?? g.gap : -(over.find(o => o.key === g.key)?.left ?? -g.gap);
    if (Math.abs(rest) >= UNIT) stuck.push({ key: g.key, name: g.name, kind: g.kind, gap: rest });
  });

  // 투자 안 테마: 옮긴 뒤 투자 금액 기준
  const invest = buckets.find(b => b.kind === 'INVEST');
  let investAfter: number | null = null;
  let themeSteps: ThemeStep[] = [];
  if (invest) {
    const flow = transfers.reduce((t, x) => t + (x.to === invest.key ? x.amount : 0) - (x.from === invest.key ? x.amount : 0), 0);
    investAfter = Math.max(invest.amount, 0) + flow;
    const themeSum = themes.reduce((s, t) => s + Math.max(t.targetPct, 0), 0);
    if (investAfter > 0 && themeSum > 0) {
      const after = investAfter;
      const cap = (t: GuideTheme) => (after * Math.max(t.targetPct, 0)) / themeSum;
      const satHeld = themes.filter(t => t.satellite).reduce((s, t) => s + Math.min(Math.max(t.value, 0), cap(t)), 0);
      const coreSum = themes.filter(t => !t.satellite).reduce((s, t) => s + Math.max(t.targetPct, 0), 0);
      const goal = (t: GuideTheme) => (t.satellite ? cap(t) : coreSum > 0 ? ((after - satHeld) * Math.max(t.targetPct, 0)) / coreSum : 0);
      themeSteps = themes.map(t => ({ t, gap: goal(t) - Math.max(t.value, 0) }))
        .filter(x => !(x.t.satellite && x.gap > 0)) // 위성은 상한 아래면 할 일 없음
        .filter(x => (Math.abs(x.gap) / after) * 100 >= themeBand && Math.abs(x.gap) >= UNIT)
        .map(({ t, gap }) => ({
          id: t.id, name: t.name, cash: t.cash, satellite: !!t.satellite,
          gap: gap > 0 ? floorUnit(gap) : -floorUnit(-gap),
          action: gap > 0 ? 'BUY' : allowSell ? 'TRIM' : 'HOLD_BUY',
        } as ThemeStep))
        .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
      if (!allowSell) {
        const need = themeSteps.filter(x => x.action === 'BUY').reduce((t, x) => t + x.gap, 0);
        const scale = flow > 0 && need > flow ? flow / need : 1;
        themeSteps = themeSteps
          .map(x => (x.action === 'BUY' ? { ...x, gap: floorUnit(x.gap * scale), fromNewMoney: flow <= 0 } : x))
          .filter(x => x.gap !== 0);
      }
    }
  }

  return {
    total, gaps, transfers, stuck, investAfter, themeSteps,
    balanced: transfers.length === 0 && stuck.length === 0 && themeSteps.length === 0,
  };
}
