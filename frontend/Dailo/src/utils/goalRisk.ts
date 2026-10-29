// 계좌 목적·사용 예정일 기준 위험자산 비중 안내 — 날짜가 있는 계좌만, 가까워질수록 상한을 낮춤.
// 흔히 쓰는 '목표일이 가까울수록 안전자산을 늘린다(글라이드 패스)'를 단순화한 참고 기준. 투자 권유 아님.

export type AccountPurpose = 'RETIRE' | 'HOUSE' | 'WEDDING' | 'OTHER';

export const PURPOSE_OPTIONS: { value: AccountPurpose; label: string }[] = [
  { value: 'RETIRE', label: '노후' },
  { value: 'HOUSE', label: '주택' },
  { value: 'WEDDING', label: '결혼' },
  { value: 'OTHER', label: '기타' },
];

export const purposeLabel = (p: string | null | undefined): string =>
  PURPOSE_OPTIONS.find(o => o.value === p)?.label ?? '미정';

/** 'YYYY-MM'까지 남은 개월 수 (이번 달 = 0, 지났으면 음수). 형식이 틀리면 null */
export function monthsUntil(targetDate: string | null | undefined, today: Date = new Date()): number | null {
  const m = targetDate?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!m) return null;
  return (Number(m[1]) - today.getFullYear()) * 12 + (Number(m[2]) - 1 - today.getMonth());
}

/** 남은 기간별 위험자산 상한(%) — 3년 넘게 남았으면 제한 없음(null) */
export function riskCap(months: number): number | null {
  if (months > 36) return null;
  if (months > 24) return 60;
  if (months > 12) return 40;
  return 20;
}

// 안전자산: 현금성 테마 or 종목코드 없는 금액 줄(예수금·MMF) or 이름에 채권·국채·MMF·CMA·예금
const SAFE_NAME = /채권|국채|국고채|단기채|MMF|CMA|예금|파킹|머니마켓|KOFR|CD금리/i;
export const isSafeHolding = (h: { ticker: string; stockCode?: string | null; manualValue?: number | null }, inCashTheme = false) =>
  inCashTheme || (h.manualValue != null && !h.stockCode) || SAFE_NAME.test(h.ticker);

export interface GoalCheck {
  months: number;
  cap: number | null;      // null = 제한 없음
  riskyPct: number;        // 현재 위험자산 비중 %
  over: boolean;           // 상한 초과
}

/** 목표일 있는 계좌의 위험자산 비중 점검. 날짜 없거나 노후 목적이거나 평가금액 0이면 null */
export function checkGoal(
  purpose: string | null | undefined, targetDate: string | null | undefined,
  holdings: { value: number; safe: boolean }[], today: Date = new Date(),
): GoalCheck | null {
  if (purpose === 'RETIRE') return null;
  const months = monthsUntil(targetDate, today);
  if (months == null) return null;
  const total = holdings.reduce((s, h) => s + Math.max(h.value, 0), 0);
  if (total <= 0) return null;
  const risky = holdings.filter(h => !h.safe).reduce((s, h) => s + Math.max(h.value, 0), 0);
  const riskyPct = (risky / total) * 100;
  const cap = riskCap(months);
  return { months, cap, riskyPct, over: cap != null && riskyPct > cap };
}
