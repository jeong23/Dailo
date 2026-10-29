// 투자 전략 프리셋 — 가입·설정 때 질문 3개로 고르고, 계좌별 월 납입금·매도 허용·계좌 목적을 한 번에 채운다.
// 프리셋은 출발점일 뿐: 적용 후에도 계좌 납입금·매도 허용은 각각 바꿀 수 있음. 상품(종목)은 추천하지 않음.

export type StrategyPreset = 'LIQUIDITY' | 'TAX' | 'EQUAL' | 'CUSTOM';

export interface PresetInfo { id: StrategyPreset; name: string; summary: string; allowSell: boolean }

export const PRESETS: Record<StrategyPreset, PresetInfo> = {
  LIQUIDITY: { id: 'LIQUIDITY', name: '유동성 우선', summary: 'ISA·일반 계좌에 모으고, 연금은 여유 생길 때', allowSell: false },
  TAX: { id: 'TAX', name: '세액공제 우선', summary: '연봉 기준 공제받을 만큼 연금저축 → IRP에 넣고 남는 돈은 ISA', allowSell: true },
  EQUAL: { id: 'EQUAL', name: '균등 적립', summary: '계좌마다 정한 비율대로 매달 나눠 넣기', allowSell: true },
  CUSTOM: { id: 'CUSTOM', name: '직접 설정', summary: '계좌별 납입금을 직접 입력', allowSell: true },
};

export interface PresetAnswers {
  bigSpendIn5y: boolean;      // 5년 안에 큰돈(결혼·집) 쓸 계획
  preferTaxCredit: boolean;   // 출금 자유보다 세액공제가 중요
  sellWhenLosing: boolean;    // 손실 중이어도 팔아서 비중 맞추기
}

/** 질문 답 → 추천 프리셋 + 매도 허용 (매도는 답 그대로) */
export function recommendPreset(a: PresetAnswers): { preset: StrategyPreset; allowSell: boolean } {
  const preset: StrategyPreset = a.bigSpendIn5y && !a.preferTaxCredit ? 'LIQUIDITY'
    : a.preferTaxCredit ? 'TAX'
    : 'EQUAL';
  return { preset, allowSell: a.sellWhenLosing };
}

// 세액공제 대상 연간 한도 (2026 기준, 참고값 — 세법 바뀌면 여기만)
export const PENSION_ANNUAL_CAP = 6_000_000;        // 연금저축 단독
export const PENSION_IRP_ANNUAL_CAP = 9_000_000;    // 연금저축 + IRP 합산

export interface PresetAccount { id: number; type: string; targetPct: number }

/**
 * 월 투자금을 프리셋 규칙으로 계좌별 월 납입금으로 나눈다 (원 단위, 합계 = monthly).
 *  LIQUIDITY: ISA(없으면 일반) 한 곳에 전부 — 여러 개면 첫 계좌. 둘 다 없으면 EQUAL로
 *  TAX: 연금저축 → IRP → 나머지 ISA → 일반. 같은 종류 여러 개면 첫 계좌
 *       taxCaps(회원 연봉으로 계산한 '소득세를 0으로 만드는 월 납입액')가 있으면 그만큼만, 없으면 법정 한도(월 50만 / 25만)
 *       — 한도까지 넣어도 낼 세금보다 많으면 공제를 못 받으므로 연봉 기준이 맞음
 *  EQUAL / CUSTOM: 계좌 targetPct 비율 (합 0이면 균등)
 */
export function splitContribution(
  preset: StrategyPreset, accounts: PresetAccount[], monthly: number,
  taxCaps?: { pensionMonthly: number; irpMonthly: number } | null,
): Record<number, number> {
  const out: Record<number, number> = {};
  accounts.forEach(a => { out[a.id] = 0; });
  const money = Math.max(Math.floor(monthly), 0);
  if (accounts.length === 0 || money === 0) return out;
  const first = (type: string) => accounts.find(a => a.type === type);

  if (preset === 'LIQUIDITY') {
    const target = first('ISA') ?? first('GENERAL');
    if (target) { out[target.id] = money; return out; }
  }

  if (preset === 'TAX') {
    let rest = money;
    const steps: [PresetAccount | undefined, number][] = [
      [first('PENSION'), taxCaps ? Math.max(taxCaps.pensionMonthly, 0) : Math.floor(PENSION_ANNUAL_CAP / 12)],
      [first('IRP'), taxCaps ? Math.max(taxCaps.irpMonthly, 0) : Math.floor((PENSION_IRP_ANNUAL_CAP - PENSION_ANNUAL_CAP) / 12)],
      [first('ISA'), Infinity],
      [first('GENERAL'), Infinity],
    ];
    for (const [acc, cap] of steps) {
      if (!acc || rest <= 0) continue;
      const put = Math.min(rest, cap);
      out[acc.id] += put;
      rest -= put;
    }
    // 받을 계좌가 연금뿐이라 한도를 넘는 돈은 첫 계좌에 (공제는 안 되지만 납입은 가능)
    if (rest > 0) out[accounts[0].id] += rest;
    return out;
  }

  const weightSum = accounts.reduce((s, a) => s + Math.max(a.targetPct, 0), 0);
  const weight = (a: PresetAccount) => (weightSum > 0 ? Math.max(a.targetPct, 0) / weightSum : 1 / accounts.length);
  let given = 0;
  accounts.forEach(a => { out[a.id] = Math.floor(money * weight(a)); given += out[a.id]; });
  out[accounts[0].id] += money - given; // 내림 오차는 첫 계좌에
  return out;
}

/** 계좌 종류별 기본 목적 — 연금저축·IRP는 노후, 나머지는 미정 */
export const defaultPurpose = (type: string): string | null => (type === 'PENSION' || type === 'IRP' ? 'RETIRE' : null);
