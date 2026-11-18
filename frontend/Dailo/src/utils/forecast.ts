// 이 속도면 월말에 — 정산 기간 중 지난 날 수로 지금까지 쓴 돈을 비례 확대
//  오늘이 정산 기간 밖(지난 달·다음 달 화면)이거나 3일 미만이면 null — 첫날 큰 지출 하나로 예측이 튀는 것 방지
export const MIN_FORECAST_DAYS = 3;

export interface Forecast {
  elapsedDays: number;   // 오늘 포함 지난 날
  totalDays: number;     // 정산 기간 전체 날
  projected: number;     // 월말 예상 지출 (원, 반올림)
  dailyAllowance: number | null; // 남은 날 하루에 쓸 수 있는 돈 (예산 있을 때, 음수면 0)
}

const dayIndex = (d: Date) => Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);

export const monthEndForecast = (
  spent: number, budget: number, period: { start: Date; end: Date }, today: Date,
): Forecast | null => {
  const s = dayIndex(period.start), e = dayIndex(period.end), t = dayIndex(today);
  if (t < s || t > e) return null;
  const totalDays = e - s + 1;
  const elapsedDays = t - s + 1;
  if (elapsedDays < MIN_FORECAST_DAYS) return null;
  const projected = Math.round((spent / elapsedDays) * totalDays);
  // 오늘 쓴 것도 이미 들어가 있으니 남은 날 = 내일부터
  const remainingDays = totalDays - elapsedDays;
  const dailyAllowance = budget > 0 && remainingDays > 0 ? Math.max(0, Math.floor((budget - spent) / remainingDays)) : null;
  return { elapsedDays, totalDays, projected, dailyAllowance };
};
