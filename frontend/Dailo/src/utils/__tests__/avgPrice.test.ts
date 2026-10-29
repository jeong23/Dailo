import { avgPriceFromReturn } from '../avgPrice';

describe('avgPriceFromReturn', () => {
  it('현재가 기준: 수익 중', () => {
    expect(avgPriceFromReturn(21000, 12.5, 'price')).toBe(18667);
  });
  it('현재가 기준: 손실 중', () => {
    expect(avgPriceFromReturn(9000, -10, 'price')).toBe(10000);
  });
  it('평가금액 기준: 수량으로 나눔', () => {
    expect(avgPriceFromReturn(1125000, 12.5, 'total', 50)).toBe(20000);
  });
  it('평가금액 기준인데 수량 없으면 null', () => {
    expect(avgPriceFromReturn(1125000, 12.5, 'total')).toBeNull();
    expect(avgPriceFromReturn(1125000, 12.5, 'total', 0)).toBeNull();
  });
  it('-100% 이하·0 이하 값·NaN은 null', () => {
    expect(avgPriceFromReturn(10000, -100, 'price')).toBeNull();
    expect(avgPriceFromReturn(0, 5, 'price')).toBeNull();
    expect(avgPriceFromReturn(10000, NaN, 'price')).toBeNull();
  });
  it('수익률 0이면 그대로', () => {
    expect(avgPriceFromReturn(15000, 0, 'price')).toBe(15000);
  });
});
