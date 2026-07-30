// 고정 4~5항목(생활비/ISA/연금저축/비상금/자유재량)의 항목명 localStorage 관리.
// 가변 추가 항목(옛 extra1~3)은 이제 서버 MonthlyBudget.allocationItems에 label+rate로 함께 저장되므로
// 여기서는 관리하지 않는다 (BudgetSettingsPage의 allocationItems state 참고).
export type AllocationKey = 'living' | 'isa' | 'pension' | 'emergency' | 'discretionary';

const STORAGE_KEY = 'allocationLabels';

export const DEFAULT_LABELS: Record<AllocationKey, string> = {
  living: '생활비',
  isa: 'ISA',
  pension: '연금저축',
  emergency: '비상금',
  discretionary: '자유재량',
};

export function getAllocationLabels(): Record<AllocationKey, string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_LABELS, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_LABELS };
}

export function setAllocationLabels(labels: Record<AllocationKey, string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
  window.dispatchEvent(new Event('allocationLabelsUpdated'));
}
