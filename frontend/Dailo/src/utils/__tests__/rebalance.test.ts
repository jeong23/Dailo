import { allocateContribution, overweightAfter } from '../rebalance';

const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

describe('allocateContribution', () => {
  it('이미 목표 비중이면 목표 비중대로 나눈다', () => {
    const r = allocateContribution([
      { id: 1, value: 600_000, weight: 60 },
      { id: 2, value: 400_000, weight: 40 },
    ], 100_000);
    expect(r.map(x => x.amount)).toEqual([60_000, 40_000]);
  });

  it('모자란 종목이 납입금보다 크게 부족하면 그 종목에 전부 넣는다', () => {
    const r = allocateContribution([
      { id: 1, value: 300_000, weight: 50 },
      { id: 2, value: 700_000, weight: 50 },
    ], 100_000);
    expect(r.map(x => x.amount)).toEqual([100_000, 0]);
  });

  it('부족분을 채우고 남는 돈은 목표 비중대로 나눈다', () => {
    // 납입 후 총액 1,100,000 → 목표 550,000씩. 1번 부족 50,000, 2번 0. 남는 50,000은 반반
    const r = allocateContribution([
      { id: 1, value: 500_000, weight: 50 },
      { id: 2, value: 500_000, weight: 50 },
    ], 100_000);
    expect(r.map(x => x.amount)).toEqual([50_000, 50_000]);

    const r2 = allocateContribution([
      { id: 1, value: 450_000, weight: 50 },
      { id: 2, value: 550_000, weight: 50 },
    ], 300_000);
    // 총 1,300,000 → 목표 650,000씩. 부족 200,000 / 100,000 = 300,000 딱 맞음
    expect(r2.map(x => x.amount)).toEqual([200_000, 100_000]);
  });

  it('여러 종목이 부족하면 부족분 비율대로 나눈다', () => {
    const r = allocateContribution([
      { id: 1, value: 0, weight: 50 },
      { id: 2, value: 0, weight: 30 },
      { id: 3, value: 1_000_000, weight: 20 },
    ], 100_000);
    // 총 1,100,000 → 목표 550,000 / 330,000. 부족 합 880,000 > 100,000 → 5:3
    expect(r.map(x => x.amount)).toEqual([62_500, 37_500, 0]);
  });

  it('원 단위 반올림 후에도 합계는 납입금과 같다', () => {
    const r = allocateContribution([
      { id: 1, value: 0, weight: 1 },
      { id: 2, value: 0, weight: 1 },
      { id: 3, value: 0, weight: 1 },
    ], 100_000);
    expect(sum(r)).toBe(100_000);
    expect(Math.max(...r.map(x => x.amount)) - Math.min(...r.map(x => x.amount))).toBeLessThanOrEqual(1);
  });

  it('가격이 있으면 살 수 있는 주수를, 없으면 null', () => {
    const r = allocateContribution([
      { id: 1, value: 0, weight: 100, price: 19_850 },
      { id: 2, value: 0, weight: 0, price: null },
    ], 100_000);
    expect(r[0].shares).toBe(5);
    expect(r[1].shares).toBeNull();
  });

  it('납입금 0이나 비중 0이면 배분 없음', () => {
    expect(sum(allocateContribution([{ id: 1, value: 100, weight: 100 }], 0))).toBe(0);
    expect(sum(allocateContribution([{ id: 1, value: 100, weight: 0 }], 50_000))).toBe(0);
  });

  it('납입 후에도 목표보다 기준 이상 무거운 종목을 찾는다', () => {
    const r = allocateContribution([
      { id: 1, value: 900_000, weight: 50 },
      { id: 2, value: 100_000, weight: 50 },
    ], 100_000);
    // 1번: 900,000 / 1,100,000 = 81.8% vs 50%
    expect(overweightAfter(r, 5).map(x => x.id)).toEqual([1]);
    expect(overweightAfter(r, 40)).toEqual([]);
  });
});
