export type CashflowPoint = {
  month: string;
  income: number;
  expenses: number;
};

export type HealthBreakdownItem = {
  value: number;
  score: number;
  max: number;
  status: string;
};

export type HealthScoreData = {
  score: number;
  breakdown: Record<string, HealthBreakdownItem>;
  trend: number[];
  comparison: {
    available?: boolean;
    percentile?: number;
    avg_score?: number;
    sample_size?: number;
    note?: string;
  };
};

export type DashboardGoal = {
  title: string;
  progress_pct: number;
  on_track: boolean;
};

export type DashboardAlert = {
  alert_id?: string;
  title: string;
  severity?: string;
  message?: string;
};

export type DashboardData = {
  health_score: {
    score: number;
    trend: string;
  };
  monthly_overview: {
    income: number;
    expenses: number;
    savings: number;
  };
  spending_breakdown: Record<string, number>;
  cashflow_chart: CashflowPoint[];
  active_goals: DashboardGoal[];
  recent_alerts: DashboardAlert[];
  quick_insights: string[];
};

export type GoalRecord = {
  goal_id?: string;
  title: string;
  target_amount: number;
  current_amount: number;
  timeline_months: number;
  target_date?: string;
  monthly_required?: number | null;
  success_probability?: number | null;
  status?: string;
};

export type GoalPrediction = {
  goal: GoalRecord;
  on_track: boolean;
  months_remaining: number;
  projected_amount: number;
  success_probability: number;
  recommended_adjustments: string[];
};

export type TransactionMonthlySummary = {
  month: string;
  income: number;
  expenses: number;
  savings: number;
};

export type TopMerchant = {
  name: string;
  total: number;
  count: number;
};

export type RecurringExpense = {
  merchant: string;
  amount: number;
  frequency: string;
};

export type TransactionSummary = {
  monthly_summary: TransactionMonthlySummary[];
  category_totals: Record<string, number>;
  top_merchants: TopMerchant[];
  recurring_expenses: RecurringExpense[];
};

export type UserProfile = {
  user_id: string;
  name: string;
  email: string;
  monthly_income: number | null;
  currency: string;
  tax_regime: "old" | "new";
  onboarding_done: boolean;
};
