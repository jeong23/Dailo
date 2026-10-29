import { matchAccount, matchSavings, suggestLinks } from '../accountLink';

const accounts = [
  { id: 1, type: 'PENSION' },
  { id: 2, type: 'IRP' },
  { id: 3, type: 'ISA' },
];

describe('matchAccount', () => {
  it('항목명으로 계좌 종류 추정', () => {
    expect(matchAccount('ISA', accounts)).toBe(3);
    expect(matchAccount('연금저축', accounts)).toBe(1);
    expect(matchAccount('IRP 연금', accounts)).toBe(2); // IRP가 연금보다 먼저
    expect(matchAccount('생활비', accounts)).toBeNull();
    expect(matchAccount('ISA', [{ id: 1, type: 'PENSION' }])).toBeNull();
  });
});

describe('suggestLinks', () => {
  const items = [
    { label: '생활비', investAccountId: null },
    { label: 'ISA', investAccountId: null },
    { label: '연금저축', investAccountId: null },
  ];
  it('연결이 하나도 없으면 이름으로 채움', () => {
    expect(suggestLinks(items, accounts).map(i => i.investAccountId)).toEqual([null, 3, 1]);
  });
  it('이미 하나라도 연결돼 있으면 사용자 선택 그대로', () => {
    const chosen = [{ label: 'ISA', investAccountId: null }, { label: '연금저축', investAccountId: 1 }];
    expect(suggestLinks(chosen, accounts)).toBe(chosen);
  });
  it('같은 계좌에 두 항목이 맞으면 첫 항목만', () => {
    const dup = [{ label: 'ISA', investAccountId: null }, { label: 'ISA 추가', investAccountId: null }];
    expect(suggestLinks(dup, accounts).map(i => i.investAccountId)).toEqual([3, null]);
  });
});

describe('적금 연결', () => {
  const savings = [
    { id: 7, name: '청년미래적금', kind: 'SAVINGS' },
    { id: 8, name: '주택청약종합저축', kind: 'HOUSING' },
  ];
  it('이름이 서로 포함되면 그 적금, 청약 항목은 주택청약', () => {
    expect(matchSavings('청년 미래적금', savings)).toBe(7);
    expect(matchSavings('청약', savings)).toBe(8);
    expect(matchSavings('생활비', savings)).toBeNull();
  });
  it('투자 계좌와 적금을 함께 자동 연결 (한 항목엔 하나만)', () => {
    const items = [
      { label: 'ISA', investAccountId: null, savingsId: null },
      { label: '청년미래적금', investAccountId: null, savingsId: null },
    ];
    const r = suggestLinks(items, accounts, savings);
    expect(r.map(i => [i.investAccountId, i.savingsId])).toEqual([[3, null], [null, 7]]);
  });
  it('적금만 연결돼 있어도 사용자 선택으로 봄', () => {
    const chosen = [{ label: 'ISA', investAccountId: null, savingsId: 7 }];
    expect(suggestLinks(chosen, accounts, savings)).toBe(chosen);
  });
});
