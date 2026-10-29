import { duplicateCodes, mergeDuplicates } from '../mergeHoldings';

describe('mergeHoldings', () => {
  const ai15 = { id: 7, ticker: 'TIGER 글로벌AI 15만', targetPct: 50, stockCode: '464310', avgPurchasePrice: 15029 };
  const aiHeld = { id: 10, ticker: 'TIGER 글로벌AI', targetPct: 0, stockCode: '464310', shares: 32, avgPurchasePrice: 15029 };
  const semi = { id: 8, ticker: 'KODEX 반도체', targetPct: 33, stockCode: '091160', shares: 4, avgPurchasePrice: 135642 };

  it('중복 종목코드를 찾음 (대소문자 무시, 코드 없는 줄 제외)', () => {
    expect(duplicateCodes([ai15, aiHeld, semi, { ticker: '현금', targetPct: 0 }])).toEqual(['464310']);
    expect(duplicateCodes([semi])).toEqual([]);
  });

  it('목표 비중 큰 줄로 합치고 수량·비중은 더함', () => {
    const merged = mergeDuplicates([ai15, semi, aiHeld]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ id: 7, ticker: 'TIGER 글로벌AI 15만', targetPct: 50, shares: 32, avgPurchasePrice: 15029 });
    expect(merged[1]).toBe(semi);
  });

  it('평균단가는 수량 가중평균', () => {
    const a = { id: 1, ticker: 'A', targetPct: 60, stockCode: '360750', shares: 1, avgPurchasePrice: 30000 };
    const b = { id: 2, ticker: 'A2', targetPct: 6, stockCode: '360750', shares: 3, avgPurchasePrice: 26000 };
    expect(mergeDuplicates([a, b])[0]).toMatchObject({ id: 1, targetPct: 66, shares: 4, avgPurchasePrice: 27000 });
  });
});

import { DEFAULT_THEMES, guessThemeIndex } from '../themeDefaults';

describe('guessThemeIndex', () => {
  const name = (t: string) => { const i = guessThemeIndex(t); return i < 0 ? null : DEFAULT_THEMES[i].name; };
  it('지금 보유 종목들을 테마로 나눔', () => {
    expect(name('TIGER 미국S&P500 20만')).toBe('미국 지수');
    expect(name('TIGER 미국나스닥100')).toBe('미국 지수');
    expect(name('TIGER 글로벌AI&로보틱스 INDXX')).toBe('AI·테크');
    expect(name('KODEX 반도체 10만')).toBe('AI·테크');
    expect(name('ACE KRX금현물 5만')).toBe('원자재');
    expect(name('KODEX WTI원유선물(H) 5만')).toBe('원자재');
    expect(name('KODEX 200 10만')).toBe('국내 지수');
    expect(name('KODEX 단기채권PLUS 5만')).toBe('현금성');
    expect(name('현금성자산(삼성증권)')).toBe('현금성');
    expect(name('삼성증권 디폴트옵션 안정형 포트폴리오')).toBe('현금성');
    expect(name('현금잔고(예수금)')).toBe('현금성');
    expect(name('알 수 없는 종목')).toBeNull();
  });
  it('추천 목표 합계는 100', () => {
    expect(DEFAULT_THEMES.reduce((s, t) => s + t.targetPct, 0)).toBe(100);
  });
});
