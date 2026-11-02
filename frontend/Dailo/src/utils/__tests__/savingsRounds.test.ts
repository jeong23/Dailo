import { recentRounds } from '../savings';

// 월급일 25일 기준 정산월
const settle = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1 + (d >= 25 ? 1 : 0), 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
};
const rec = (settleMonth: string, amount = 300_000) => ({ expenseId: 1, date: `${settleMonth}-05`, settleMonth, amount, itemName: null });

describe('recentRounds', () => {
  it('최근 3회 + 다음 납입, 정산월에 기록 있으면 RECORDED', () => {
    const r = recentRounds('2026-06-05', 12, '2026-11-02', [rec('2026-10')], settle);
    expect(r.map(x => [x.date, x.status])).toEqual([
      ['2026-08-05', 'MISSING'], ['2026-09-05', 'MISSING'], ['2026-10-05', 'RECORDED'], ['2026-11-05', 'UPCOMING'],
    ]);
  });

  it('다음 납입도 미리 적었으면 RECORDED', () => {
    const r = recentRounds('2026-06-05', 12, '2026-11-02', [rec('2026-11')], settle);
    expect(r[r.length - 1]).toMatchObject({ date: '2026-11-05', status: 'RECORDED', recorded: 300_000 });
  });

  it('만기 지나면 다음 납입 없음, 청약(0개월)은 계속', () => {
    expect(recentRounds('2026-01-05', 3, '2026-11-02', [], settle).map(x => x.date)).toEqual(['2026-01-05', '2026-02-05', '2026-03-05']);
    expect(recentRounds('2025-05-10', 0, '2026-11-02', [], settle).map(x => x.date)).toEqual(['2026-08-10', '2026-09-10', '2026-10-10', '2026-11-10']);
  });

  it('월급일 이후 납입일은 다음 정산월 기록과 맞춤', () => {
    const r = recentRounds('2026-09-28', 12, '2026-11-02', [rec('2026-11')], settle);
    expect(r.map(x => [x.date, x.settleMonth, x.status])).toEqual([
      ['2026-09-28', '2026-10', 'MISSING'], ['2026-10-28', '2026-11', 'RECORDED'], ['2026-11-28', '2026-12', 'UPCOMING'],
    ]);
  });
});

describe('currentPrincipal 만기', () => {
  it('만기 지난 적금은 0 (현금으로 넘어감)', () => {
    const { currentPrincipal } = require('../savings');
    const s = { monthlyAmount: 300_000, startDate: '2025-01-05', months: 12, ratePct: 3, taxFree: false, kind: 'SAVINGS' };
    expect(currentPrincipal(s, '2026-11-02')).toBe(0);
    expect(currentPrincipal({ ...s, startDate: '2026-06-05' }, '2026-11-02')).toBe(1_500_000);
  });
});
