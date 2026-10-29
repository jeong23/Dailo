// 투자 계좌 종류별 인출 가능성 — 계좌 종류만으로 판단 (사용자 입력 없음).
// 세법·제도 문구는 여기 한 곳에서만 관리 — 규정이 바뀌면 이 파일만 고치면 됨. 화면엔 '참고용' 안내를 같이 둘 것.

export type AccountType = 'GENERAL' | 'ISA' | 'PENSION' | 'IRP';
export type LiquidityLevel = 'FREE' | 'PRINCIPAL' | 'PENALTY' | 'LOCKED';

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'PENSION', label: '연금저축' },
  { value: 'IRP', label: 'IRP' },
  { value: 'ISA', label: 'ISA' },
  { value: 'GENERAL', label: '일반' },
];

export const accountTypeLabel = (type: string): string =>
  ACCOUNT_TYPES.find(t => t.value === type)?.label ?? type;

export interface LiquidityInfo {
  level: LiquidityLevel;
  label: string;      // 배지 문구
  note: string;       // 한 줄 설명
  accessible: boolean; // 결혼·집 등 55세 전 목돈으로 꺼내 쓸 수 있는 돈으로 볼지
}

const LIQUIDITY: Record<AccountType, LiquidityInfo> = {
  GENERAL: { level: 'FREE', label: '자유 인출', note: '언제든 팔고 출금 가능', accessible: true },
  ISA: {
    level: 'PRINCIPAL', label: '원금 인출 가능', accessible: true,
    note: '납입 원금 안에서 중도인출 가능 · 의무가입 3년 전에 해지하면 비과세 혜택 반환',
  },
  PENSION: {
    level: 'PENALTY', label: '인출 시 세금', accessible: false,
    note: '55세 전에 빼면 세액공제받은 원금과 수익에 기타소득세 16.5%',
  },
  IRP: {
    level: 'LOCKED', label: '인출 제한', accessible: false,
    note: '일부 인출 불가 (무주택자 주택 구입 등 법정 사유만 중도인출) — 그 외엔 계좌 전체 해지',
  },
};

// 모르는 종류는 일반 계좌로 취급
export const liquidityOf = (type: string): LiquidityInfo =>
  LIQUIDITY[type as AccountType] ?? LIQUIDITY.GENERAL;

// 계좌별 금액 → 꺼낼 수 있는 돈 / 55세까지 묶인 돈
export function splitByAccess(accounts: { type: string; value: number }[]): { accessible: number; locked: number } {
  return accounts.reduce(
    (s, a) => (liquidityOf(a.type).accessible
      ? { ...s, accessible: s.accessible + a.value }
      : { ...s, locked: s.locked + a.value }),
    { accessible: 0, locked: 0 },
  );
}

export const LIQUIDITY_DISCLAIMER = '참고용 안내예요 — 실제 세금·인출 조건은 가입한 금융사에서 확인해주세요';
