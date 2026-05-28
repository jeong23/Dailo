// src/types/index.ts

export type PaymentMethod = '카드' | '현금' | '이체';
export type BudgetType = '생활비' | '비상금';

export interface Category {
  id: number;
  name: string;
  icon?: string;
  sortOrder?: number;
}

export interface MonthlyBudget {
  id: number;
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
