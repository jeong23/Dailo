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

// 예산 분배 가변 항목(생활비/ISA/연금저축/자유재량 4개 고정 항목 이외의 추가 항목들)
export interface AllocationItemResponseDto {
  id: number;
  label: string;
  rate: number;
  budgetAmount: number;
  sortOrder: number;
}

export interface AllocationItemRequestDto {
  label: string;
  rate: number;
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
  allocationItems: AllocationItemResponseDto[];
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
  livingBudget: number;
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
