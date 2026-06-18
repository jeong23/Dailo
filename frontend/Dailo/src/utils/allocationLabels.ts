export type AllocationKey = 'living' | 'isa' | 'pension' | 'emergency' | 'discretionary' | 'extra1' | 'extra2' | 'extra3';
export type ExtraAllocationKey = 'extra1' | 'extra2' | 'extra3';

const STORAGE_KEY = 'allocationLabels';

export const EXTRA_ALLOCATION_KEYS: ExtraAllocationKey[] = ['extra1', 'extra2', 'extra3'];

export const DEFAULT_LABELS: Record<AllocationKey, string> = {
  living: '생활비',
  isa: 'ISA',
  pension: '연금저축',
  emergency: '비상금',
  discretionary: '자유재량',
  extra1: '',
  extra2: '',
  extra3: '',
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