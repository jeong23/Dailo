// 숫자 → "1,000,000" 형태로 변환
export const formatNumber = (value: string | number): string => {
  const num = String(value).replace(/[^0-9]/g, '');
  if (!num) return '';
  return Number(num).toLocaleString();
};

// "1,000,000" → 숫자 변환
export const parseNumber = (value: string): number => {
  return Number(value.replace(/[^0-9]/g, ''));
};

// 숫자 → "-1,000,000" / "1,000,000" 형태로 변환 (선행 "-" 부호 보존)
// 음수를 허용해야 하는 필드 전용 (예: 현금 자산 잔액, 생활비 이월액)
// formatNumber와 달리 맨 앞의 "-"는 지우지 않고, 그 외 숫자가 아닌 문자만 제거한다
export const formatSignedNumber = (value: string | number): string => {
  const str = String(value);
  const isNegative = str.trim().startsWith('-');
  const digits = str.replace(/[^0-9]/g, '');
  if (!digits) return isNegative ? '-' : '';
  const formatted = Number(digits).toLocaleString();
  return isNegative ? `-${formatted}` : formatted;
};

// "-1,000,000" → 숫자 변환 (음수 허용)
export const parseSignedNumber = (value: string): number => {
  const isNegative = value.trim().startsWith('-');
  const digits = value.replace(/[^0-9]/g, '');
  const num = Number(digits || '0');
  return isNegative ? -num : num;
};

// 현재 날짜 기준 정산월 반환 (월급일 이후면 다음 달)
// 예: 월급일=25, 4/10 → "2026-04", 4/25 → "2026-05"
export const getCurrentSettleMonth = (): string => {
  const salaryDay = parseInt(localStorage.getItem('salaryDay') || '25', 10);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const day = now.getDate();

  const settleDate = day >= salaryDay
    ? new Date(year, month + 1, 1)
    : new Date(year, month, 1);

  return `${settleDate.getFullYear()}-${String(settleDate.getMonth() + 1).padStart(2, '0')}`;
};

// 특정 날짜가 속하는 정산월 반환 (월급날 기준)
export const getSettleMonthForDate = (dateStr: string): string => {
  const salaryDay = parseInt(localStorage.getItem('salaryDay') || '25', 10);
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-based
  const day = d.getDate();

  const settleDate = day >= salaryDay
    ? new Date(year, month + 1, 1)
    : new Date(year, month, 1);

  return `${settleDate.getFullYear()}-${String(settleDate.getMonth() + 1).padStart(2, '0')}`;
};

// 정산월 기준 최근 N개월 옵션 생성
export const getMonthOptions = (count = 6): string[] => {
  const current = getCurrentSettleMonth();
  const [y, m] = current.split('-').map(Number);
  const options: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(y, m - 1 - i, 1);
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return options;
};
