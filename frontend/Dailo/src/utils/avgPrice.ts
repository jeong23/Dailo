// 수익률로 평균단가 역산 — 증권 앱에 수익률·현재가(또는 평가금액)만 보일 때 사용
//   평균단가 = 현재가 ÷ (1 + 수익률)
//   평가금액 기준이면 매입금액 = 평가금액 ÷ (1 + 수익률), 평균단가 = 매입금액 ÷ 보유 수량
// 수익률은 % (12.5 = +12.5%). 계산 불가(-100% 이하, 0 이하 값, 수량 없음)면 null. 원 단위 반올림.

export type AvgPriceBasis = 'price' | 'total';

export function avgPriceFromReturn(value: number, ratePct: number, basis: AvgPriceBasis, shares?: number): number | null {
  if (!(value > 0) || !Number.isFinite(ratePct) || ratePct <= -100) return null;
  const cost = value / (1 + ratePct / 100);
  if (basis === 'price') return Math.round(cost);
  if (!shares || !(shares > 0)) return null;
  return Math.round(cost / shares);
}
