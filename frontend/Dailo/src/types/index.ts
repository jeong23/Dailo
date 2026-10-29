// src/types/index.ts

export type PaymentMethod = '카드' | '현금' | '이체';
// 예산구분: 고정 3개(생활비/비상금/투자) + 월별 예산의 가변 추가 항목(allocationItems label) 까지 허용해야 하므로
// 리터럴 유니온이 아닌 string으로 확장 (ExpensesPage 참고)
export type BudgetType = string;

export interface Category {
  id: number;
  name: string;
  icon?: string;
  sortOrder?: number;
}

// 예산 분배 항목 입력 모드 — RATE: 가용금액 대비 비율(%)로 입력, AMOUNT: 원 단위 금액을 그대로 입력
export type AllocationInputMode = 'RATE' | 'AMOUNT';

// 예산 분배 가변 항목 — 고정 슬롯 없이 전부 이 배열 하나로 관리 (라벨·비율·금액 모두 사용자 정의)
export interface AllocationItemResponseDto {
  id: number;
  label: string;
  rate: number;
  budgetAmount: number;
  sortOrder: number;
  inputMode: AllocationInputMode; // 입력창을 %입력 vs 금액입력으로 분기 렌더링하는 근거
  investAccountId?: number | null; // 연결된 투자 계좌 — 최신 달 저장 시 이 금액이 계좌 월 납입금이 됨
  savingsId?: number | null;       // 연결된 적금·청약 — 최신 달 저장 시 이 금액이 월 납입액이 됨
}

export interface AllocationItemRequestDto {
  label: string;
  rate?: number;              // RATE 모드일 때 0.0~1.0
  inputMode?: AllocationInputMode; // 생략 시 서버가 RATE로 기본 처리
  amount?: number;            // AMOUNT 모드일 때 사용자가 입력한 정수 그대로(원 단위) — 서버가 재계산 없이 저장
}

export interface MonthlyBudget {
  id: number;
  memberId?: number;
  settleMonth: string;
  netSalary: number;
  fixedCostTotal: number;
  availableAmount: number;
  livingBudget: number;
  isaAmount: number;
  pensionAmount: number;
  emergencyBudget: number;
  discretionaryBudget: number;
  cardGoal: number;
  livingCarryover: number;
  emergencyCumulative: number;
  livingRate: number;
  isaRate: number;
  pensionRate: number;
  emergencyRate: number;
  discretionaryRate: number;
  allocationItems: AllocationItemResponseDto[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyExpense {
  id?: number;
  monthlyBudgetId?: number;
  categoryId?: number;
  categoryName?: string;
  category?: Category;
  itemName: string;
  amount: number;
  expenseDate: string;
  settleMonth?: string;
  paymentMethod: PaymentMethod;
  budgetType: BudgetType;
  memo?: string;
}

export interface DashboardSummary {
  netSalary: number;
  fixedCostTotal: number;
  availableAmount: number;
  livingBudget: number;
  isaAmount: number;
  pensionAmount: number;
  emergencyBudget: number;
  discretionaryBudget: number;
  // 아래 5개 레거시 필드(livingBudget~discretionaryBudget)는 하위호환용 — 신규 화면 로직은 allocationItems만 사용
  allocationItems: AllocationItemResponseDto[];
  allocationTotal: number; // allocationItems.budgetAmount 합계 (프론트에서 직접 sum 안 해도 됨)
  livingExpenseTotal: number;
  livingBalance: number;
  cardExpenseTotal: number;
  cardGoal: number;
  cardAchievementRate: number;
  emergencyExpenseTotal: number;
  extraIncomeTotal: number;
}

export interface CategoryStats {
  categoryId: number;
  categoryName: string;
  icon?: string;
  totalAmount: number;
}

export interface DailyStats {
  date: string;
  totalAmount: number;
}

export interface EmergencyHistory {
  settleMonth: string;
  emergencyBudget: number;
  emergencyExpense: number;
  emergencyNet: number;
  cumulativeAmount: number;
}

// 현금 자산(Cash Asset) — 비상금 개념 폐지 후 신규 도입
// 내 계좌 > 현금 계좌 — 켜진 계좌 잔액 합계가 그 정산월 현금 자산(cash_asset)으로 기록됨
export interface CashAccount {
  id: number;
  name: string;
  bank: string | null;
  balance: number;
  active: boolean;
  sortOrder: number | null;
  memo: string | null;
}

export interface CashAssetEntry {
  id: number;
  settleMonth: string;
  balance: number;
  memo: string | null;
}

export interface MonthlyReport {
  settleMonth: string;
  netSalary: number;
  fixedCostTotal: number;
  extraIncomeTotal: number;
  availableAmount: number;
  allocationTotal: number; // 가변 예산 분배 항목(allocationItems) budgetAmount 합계
  allocationItems?: AllocationItemResponseDto[]; // 그 달 분배 항목 (금액은 그 달 가용금액 기준)
  livingBudget: number;   // '생활비' 항목 금액 (없으면 레거시 고정 비율)
  livingCarryover: number;
  livingExpenseTotal: number;
  livingBalance: number;
  emergencyBudget: number;
  emergencyExpenseTotal: number;
  isaAmount: number;
  pensionAmount: number;
  cardGoal: number;
  cardExpenseTotal: number;
  cardAchievementRate: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface DailyPlan {
  id?: number;
  planDate: string;
  futureVisionUrl?: string;
  identity1?: string;
  identity2?: string;
  identity3?: string;
  motivation1?: string;
  motivation2?: string;
  motivation3?: string;
  gratitude1?: string;
  gratitude2?: string;
  gratitude3?: string;
  firstTask?: string;
  feedbackStart?: string;
  feedbackMid?: string;
  feedbackEnd?: string;
}

export interface TodoItem {
  id?: number;
  planDate: string;
  content: string;
  type: 'BRAIN_DUMP' | 'BIG3';
  isDone: boolean;
  sortOrder?: number;
}

export interface TimeBoxSlot {
  id?: number;
  planDate: string;
  hour: number;
  slot1?: string;
  slot2?: string;
  slot1Done?: boolean;
  slot2Done?: boolean;
}
