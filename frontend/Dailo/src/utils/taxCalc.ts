// 세액공제 최적화 계산 유틸 (소득세법 2024 기준)

export interface TaxCalcResult {
  annualSalary: number;
  creditRate: number;
  annualTax: number;
  pensionAnnual: number;
  pensionMonthly: number;
  pensionRefund: number;
  irpNeeded: boolean;
  irpAnnual: number;
  irpMonthly: number;
  irpRefund: number;
}

// 근로소득공제 (소득세법 §47)
function calcEarnedDeduction(g: number): number {
  if (g <= 5_000_000) return g * 0.7;
  if (g <= 15_000_000) return 3_500_000 + (g - 5_000_000) * 0.4;
  if (g <= 45_000_000) return 7_500_000 + (g - 15_000_000) * 0.15;
  if (g <= 100_000_000) return 12_000_000 + (g - 45_000_000) * 0.05;
  return 14_750_000;
}

// 누진세율 (소득세법 §55, 2024)
function calcProgressiveTax(t: number): number {
  if (t <= 0) return 0;
  if (t <= 14_000_000) return t * 0.06;
  if (t <= 50_000_000) return 840_000 + (t - 14_000_000) * 0.15;
  if (t <= 88_000_000) return 6_240_000 + (t - 50_000_000) * 0.24;
  if (t <= 150_000_000) return 15_360_000 + (t - 88_000_000) * 0.35;
  if (t <= 300_000_000) return 37_060_000 + (t - 150_000_000) * 0.38;
  if (t <= 500_000_000) return 94_060_000 + (t - 300_000_000) * 0.40;
  if (t <= 1_000_000_000) return 174_060_000 + (t - 500_000_000) * 0.42;
  return 384_060_000 + (t - 1_000_000_000) * 0.45;
}

// 연간 소득세 (국세 + 지방소득세 포함) — 기본인적공제 150만 반영
export function calcAnnualTax(annualGross: number): number {
  if (annualGross <= 0) return 0;
  const earned = annualGross - calcEarnedDeduction(annualGross);
  const taxable = Math.max(0, earned - 1_500_000);
  const grossTax = calcProgressiveTax(taxable);
  // 근로소득세액공제 한도 (소득세법 §59)
  const creditLimit = annualGross <= 33_000_000 ? 740_000
    : annualGross <= 70_000_000 ? 660_000 : 500_000;
  const credit = Math.min(
    grossTax <= 500_000 ? grossTax * 0.55 : 275_000 + (grossTax - 500_000) * 0.3,
    creditLimit,
  );
  // 지방소득세 10% 포함 (세액공제율 16.5% = 국세 15% × 1.1 구조와 정합)
  return Math.round(Math.max(0, grossTax - credit) * 1.1);
}

// 실수령액 → 세전 월급 역산 (4대보험 + 소득세 반복 수렴)
// 공제율: 국민연금 4.5% / 건강보험 3.545% / 장기요양 건강보험×12.81% / 고용보험 0.9%
export function calcGrossFromNet(net: number): number {
  if (net <= 0) return 0;
  let g = net * 1.15;
  for (let i = 0; i < 80; i++) {
    const health = Math.round(g * 0.03545);
    const deductions =
      Math.round(g * 0.045) +
      health +
      Math.round(health * 0.1281) +
      Math.round(g * 0.009) +
      Math.round(calcAnnualTax(g * 12) / 12);
    const diff = net - (g - deductions);
    if (Math.abs(diff) < 10) break;
    g += diff * 0.6;
  }
  return Math.max(0, Math.round(g));
}

// 세액공제 최적화 계산 메인 함수
export function calcTaxOptimization(
  netSalary: number,
  isProbation: boolean,
  joinMonth: number,
): TaxCalcResult | null {
  if (netSalary <= 0) return null;

  const probGross = calcGrossFromNet(netSalary);
  const regGross = isProbation ? Math.round(probGross / 0.8) : probGross;
  const annualSalary = regGross * 12;
  const creditRate = annualSalary <= 55_000_000 ? 0.165 : 0.132;
  const annualTax = calcAnnualTax(annualSalary);

  // 연금저축: 소득세 전액 상계 최적 납입액 (한도 600만, 만원 단위)
  const pensionRaw = annualTax > 0 ? annualTax / creditRate : 0;
  const pensionAnnual = Math.min(Math.round(pensionRaw / 10_000) * 10_000, 6_000_000);
  const pensionRefund = Math.round(pensionAnnual * creditRate);

  // IRP: 연금저축 상계 후 잔여 세금 처리 (한도 300만)
  const remainTax = annualTax - pensionRefund;
  const irpNeeded = remainTax > 0;
  const irpAnnual = irpNeeded
    ? Math.min(Math.round((remainTax / creditRate) / 10_000) * 10_000, 3_000_000)
    : 0;
  const irpRefund = Math.round(irpAnnual * creditRate);

  const remainMonths = Math.max(1, 13 - joinMonth);

  return {
    annualSalary,
    creditRate,
    annualTax,
    pensionAnnual,
    pensionMonthly: Math.round(pensionAnnual / remainMonths),
    pensionRefund,
    irpNeeded,
    irpAnnual,
    irpMonthly: irpNeeded ? Math.round(irpAnnual / remainMonths) : 0,
    irpRefund,
  };
}

export const TAX_CALC_RESULT_KEY = 'taxCalcResult';
export const TAX_CALC_INPUTS_KEY = 'taxCalcInputs';