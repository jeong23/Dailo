import { accountTypeLabel, liquidityOf, splitByAccess } from '../accountLiquidity';

describe('liquidityOf', () => {
  it('계좌 종류별 인출 단계', () => {
    expect(liquidityOf('GENERAL').level).toBe('FREE');
    expect(liquidityOf('ISA').level).toBe('PRINCIPAL');
    expect(liquidityOf('PENSION').level).toBe('PENALTY');
    expect(liquidityOf('IRP').level).toBe('LOCKED');
  });

  it('모르는 종류는 일반 계좌로', () => {
    expect(liquidityOf('BROKERAGE').level).toBe('FREE');
    expect(accountTypeLabel('BROKERAGE')).toBe('BROKERAGE');
  });
});

describe('splitByAccess', () => {
  it('일반·ISA는 꺼낼 수 있는 돈, 연금저축·IRP는 묶인 돈', () => {
    expect(splitByAccess([
      { type: 'ISA', value: 900_000 },
      { type: 'GENERAL', value: 100_000 },
      { type: 'PENSION', value: 700_000 },
      { type: 'IRP', value: 150_000 },
    ])).toEqual({ accessible: 1_000_000, locked: 850_000 });
  });

  it('빈 목록은 0', () => {
    expect(splitByAccess([])).toEqual({ accessible: 0, locked: 0 });
  });
});
