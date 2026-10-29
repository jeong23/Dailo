// 정기적금 계산 — 매달 같은 날 같은 금액 납입, 단리.
//  납입 회차: 시작일 + k개월(k = 0..기간-1)이 오늘 이전인 횟수 (paidOverride 있으면 그 값)
//  이자(세전) = 월 납입액 × 연이율 × n(n+1)/2 ÷ 12  (1회차는 n개월, 마지막 회차는 1개월 이자)
//  세후 = 비과세가 아니면 이자소득세 15.4% 차감
//  정부기여금(청년미래적금 등): 현재 적립액 = 직접 입력(bonusBalance) 우선, 없으면 월 기여금 × 회차
//    만기 = 월 기여금 × 기간 (기여금 이자는 상품마다 달라 미반영)
// 날짜는 로컬 'YYYY-MM-DD' — toISOString(UTC)은 KST 오전에 하루 밀림

export interface SavingsInput {
  monthlyAmount: number;
  startDate: string;        // YYYY-MM-DD
  months: number;
  ratePct: number;
  taxFree: boolean;
  paidOverride?: number | null;
  monthlyBonus?: number | null;
  bonusBalance?: number | null;
}

export const TAX_RATE = 0.154;

const parse = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(y, m - 1, d); };
export const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** k개월 뒤 같은 날 — 그 달에 그 날이 없으면 말일 (1/31 + 1개월 = 2/28) */
export function addMonths(ymd: string, k: number): string {
  const d = parse(ymd);
  const target = new Date(d.getFullYear(), d.getMonth() + k, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return toYmd(target);
}

export function paidCount(s: SavingsInput, today: string): number {
  if (s.paidOverride != null) return Math.min(Math.max(s.paidOverride, 0), s.months);
  let n = 0;
  for (let k = 0; k < s.months; k++) if (addMonths(s.startDate, k) <= today) n++;
  return n;
}

export function savingsSummary(s: SavingsInput, today: string) {
  const paid = paidCount(s, today);
  const principal = paid * s.monthlyAmount;
  const n = s.months;
  const grossInterest = Math.floor((s.monthlyAmount * (s.ratePct / 100) * (n * (n + 1)) / 2) / 12);
  const tax = s.taxFree ? 0 : Math.floor(grossInterest * TAX_RATE / 10) * 10; // 원 단위 절사(10원)
  const maturityDate = addMonths(s.startDate, n);
  const daysLeft = Math.round((parse(maturityDate).getTime() - parse(today).getTime()) / 86_400_000);
  const nextPayment = paid < n ? addMonths(s.startDate, paid) : null;
  const monthlyBonus = s.monthlyBonus ?? 0;
  const bonusNow = s.bonusBalance ?? monthlyBonus * paid;
  const bonusTotal = Math.max(monthlyBonus * n, bonusNow);
  return {
    paid,
    principal,
    bonusNow,
    bonusTotal,
    current: principal + bonusNow,              // 지금 쌓인 돈 (원금 + 기여금)
    totalPrincipal: s.monthlyAmount * n,
    grossInterest,
    netInterest: grossInterest - tax,
    maturityAmount: s.monthlyAmount * n + grossInterest - tax + bonusTotal,
    maturityDate,
    daysLeft,
    nextPayment,
    status: (daysLeft <= 0 ? 'MATURED' : paid >= n ? 'DONE' : 'ACTIVE') as 'MATURED' | 'DONE' | 'ACTIVE',
  };
}

// ── 주택청약종합저축 — 만기 없이 계속 납입 ──
//  납입 회차: 시작일부터 오늘까지 지난 납입일 수 (상한 없음, paidOverride 있으면 그 값)
//  잔액: 은행 앱 잔액(balanceOverride) 우선, 없으면 월 납입액 × 회차 (이자는 금리가 낮아 원금만)
//  청약 인정 금액: 회차마다 min(월 납입액, 한도) — 한도 2024-11부터 25만, 그 전 10만
//  민영주택 예치금(지역·면적별) / 1순위 가입기간 / 소득공제(무주택 세대주, 연 300만 한도 × 40%)

export type HousingRegion = 'SEOUL_BUSAN' | 'METRO' | 'OTHER';
export interface HousingInput {
  monthlyAmount: number;
  startDate: string;
  ratePct: number;
  paidOverride?: number | null;
  balanceOverride?: number | null;
  region?: HousingRegion | null;
  householdHead?: boolean | null;
}

export const REGION_LABEL: Record<HousingRegion, string> = {
  SEOUL_BUSAN: '서울·부산',
  METRO: '기타 광역시',
  OTHER: '기타 시·군',
};
// 민영주택 청약 예치금 (만원) — 85㎡ 이하 / 102㎡ 이하 / 135㎡ 이하 / 모든 면적
export const DEPOSIT_TIERS: Record<HousingRegion, number[]> = {
  SEOUL_BUSAN: [300, 600, 1000, 1500],
  METRO: [250, 400, 700, 1000],
  OTHER: [200, 300, 400, 500],
};
export const AREA_LABELS = ['85㎡ 이하', '102㎡ 이하', '135㎡ 이하', '모든 면적'];
// 1순위 가입기간(개월) — 지역마다 다르고 투기과열지구는 더 김
export const FIRST_RANK = [
  { label: '비수도권', months: 6 },
  { label: '수도권', months: 12 },
  { label: '투기과열지구', months: 24 },
];
export const RECOGNIZE_CAP = 250_000;
const OLD_RECOGNIZE_CAP = 100_000;
const CAP_CHANGED = '2024-11-01';
export const DEDUCTION_LIMIT = 3_000_000;
export const DEDUCTION_RATE = 0.4;

const capOn = (date: string) => (date < CAP_CHANGED ? OLD_RECOGNIZE_CAP : RECOGNIZE_CAP);

export function housingSummary(h: HousingInput, today: string) {
  // 자동 회차의 납입일 목록 (회차를 직접 넣으면 시작일부터 빠짐없이 냈다고 봄)
  const dates: string[] = [];
  for (let k = 0; ; k++) {
    const d = addMonths(h.startDate, k);
    if (d > today) break;
    dates.push(d);
  }
  const paid = h.paidOverride != null ? Math.max(h.paidOverride, 0) : dates.length;
  const paidDates = Array.from({ length: paid }, (_, k) => addMonths(h.startDate, k));
  const principal = h.balanceOverride != null ? h.balanceOverride : paid * h.monthlyAmount;
  const recognized = paidDates.reduce((t, d) => t + Math.min(h.monthlyAmount, capOn(d)), 0);

  // 가입기간(개월): 시작일부터 꽉 찬 개월 수
  let joinedMonths = 0;
  while (addMonths(h.startDate, joinedMonths + 1) <= today) joinedMonths++;

  // 예치금 — 잔액 기준 충족한 가장 큰 면적
  const tiers = DEPOSIT_TIERS[h.region ?? 'SEOUL_BUSAN'].map(v => v * 10_000);
  const tierIdx = tiers.reduce((best, v, i) => (principal >= v ? i : best), -1);
  const nextTier = tierIdx + 1 < tiers.length ? tiers[tierIdx + 1] : null;

  // 올해 소득공제 — 올해 납입일 기준 (이미 낸 것 + 12월까지 낼 것)
  const year = today.slice(0, 4);
  let paidThisYear = 0;
  let plannedThisYear = 0;
  for (let k = 0; ; k++) {
    const d = addMonths(h.startDate, k);
    if (d.slice(0, 4) > year) break;
    if (d.slice(0, 4) < year) continue;
    if (d <= today) paidThisYear += h.monthlyAmount; else plannedThisYear += h.monthlyAmount;
  }
  const deduction = (amount: number) => Math.floor(Math.min(amount, DEDUCTION_LIMIT) * DEDUCTION_RATE);
  const nextPayment = addMonths(h.startDate, dates.length);

  return {
    paid,
    principal,
    recognized,
    overCap: h.monthlyAmount > RECOGNIZE_CAP,   // 25만 넘게 넣는 돈은 청약 인정 안 됨
    joinedMonths,
    tierIdx,                                     // -1이면 85㎡ 이하 예치금도 아직
    tiers,
    nextTier,
    yearlyInterest: Math.floor(principal * (h.ratePct / 100)),
    paidThisYear,
    expectedThisYear: paidThisYear + plannedThisYear,
    deductionNow: h.householdHead ? deduction(paidThisYear) : 0,
    deductionExpected: h.householdHead ? deduction(paidThisYear + plannedThisYear) : 0,
    nextPayment,
  };
}

/** 자산 배분 '적금' 칸에 들어갈 지금 쌓인 돈 — 종류에 맞게 (적금은 정부기여금 포함) */
export function currentPrincipal(s: SavingsInput & HousingInput & { kind?: string | null }, today: string): number {
  return s.kind === 'HOUSING' ? housingSummary(s, today).principal : savingsSummary(s, today).current;
}
