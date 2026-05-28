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
}