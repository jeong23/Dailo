import { monthEndForecast } from '../forecast';
import { settlePeriod } from '../format';

const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe('settlePeriod', () => {
  it('월급일 25 → 전달 25일 ~ 이번 달 24일', () => {
    const p = settlePeriod('2026-12', 25);
    expect(ymd(p.start)).toBe('2026-11-25');
    expect(ymd(p.end)).toBe('2026-12-24');
  });
  it('월급일 1 → 전달 1일 ~ 전달 말일', () => {
    const p = settlePeriod('2026-03', 1);
    expect(ymd(p.start)).toBe('2026-2-1');
    expect(ymd(p.end)).toBe('2026-2-28');
  });
  it('월급일 31인데 전달이 30일까지면 이번 달 1일부터', () => {
    const p = settlePeriod('2026-12', 31); // 11월은 30일
    expect(ymd(p.start)).toBe('2026-12-1');
    expect(ymd(p.end)).toBe('2026-12-30');
  });
});

describe('monthEndForecast', () => {
  const period = { start: new Date(2026, 10, 25), end: new Date(2026, 11, 24) }; // 30일

  it('지난 날 비례로 월말 지출 예상', () => {
    const f = monthEndForecast(300_000, 900_000, period, new Date(2026, 11, 4)); // 10일째
    expect(f).toEqual({ elapsedDays: 10, totalDays: 30, projected: 900_000, dailyAllowance: 30_000 });
  });
  it('3일 미만이면 예측 안 함', () => {
    expect(monthEndForecast(50_000, 900_000, period, new Date(2026, 10, 26))).toBeNull();
  });
  it('기간 밖(지난 달 화면)이면 null', () => {
    expect(monthEndForecast(50_000, 900_000, period, new Date(2026, 11, 25))).toBeNull();
  });
  it('예산을 이미 넘었으면 하루 쓸 돈 0', () => {
    const f = monthEndForecast(1_000_000, 900_000, period, new Date(2026, 11, 4));
    expect(f?.dailyAllowance).toBe(0);
  });
});
