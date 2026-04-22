import type {
  DashboardData,
  GoalPrediction,
  HealthScoreData,
  TransactionSummary,
} from "@/lib/types";

export const mockDashboard: DashboardData = {
  health_score: { score: 72, trend: "improving" },
  monthly_overview: { income: 85000, expenses: 52000, savings: 33000 },
  spending_breakdown: {
    food_dining: 15000,
    transport: 5000,
    subscriptions: 2400,
    rent_housing: 18000,
    investments: 8500,
    groceries: 6200,
  },
  cashflow_chart: [
    { month: "2026-01", income: 80000, expenses: 48000 },
    { month: "2026-02", income: 82000, expenses: 50000 },
    { month: "2026-03", income: 85000, expenses: 52000 },
    { month: "2026-04", income: 87000, expenses: 51000 },
  ],
  active_goals: [
    { title: "Emergency fund", progress_pct: 68, on_track: true },
    { title: "Buy car", progress_pct: 34.5, on_track: true },
    { title: "Tax reserve", progress_pct: 51, on_track: false },
  ],
  recent_alerts: [
    { title: "Food delivery spending up 18%", severity: "warning" },
    { title: "Emergency fund below 6-month target", severity: "info" },
  ],
  quick_insights: [
    "Your savings rate stayed above 35% for the third straight month.",
    "Subscriptions are flat, but discretionary dining is still your highest leak.",
    "Your car goal remains on track if monthly savings stay above Rs 14,000.",
  ],
};

export const mockHealthScore: HealthScoreData = {
  score: 72,
  breakdown: {
    savings_rate: { value: 0.25, score: 18, max: 25, status: "good" },
    debt_ratio: { value: 0.15, score: 20, max: 25, status: "good" },
    spending_behavior: { value: 0.6, score: 14, max: 20, status: "warning" },
    emergency_fund: { value: 4.2, score: 12, max: 15, status: "good" },
    investment_rate: { value: 0.1, score: 8, max: 15, status: "needs_work" },
  },
  trend: [65, 68, 70, 72],
  comparison: { percentile: 68, avg_score: 58 },
};

export const mockGoalPredictions: GoalPrediction[] = [
  {
    goal: { title: "Buy car", target_amount: 500000, current_amount: 170000, timeline_months: 36 },
    on_track: true,
    months_remaining: 24,
    projected_amount: 520000,
    success_probability: 82.3,
    recommended_adjustments: ["Keep monthly saving above Rs 14,000 to stay above 80% confidence."],
  },
  {
    goal: { title: "Emergency fund", target_amount: 360000, current_amount: 245000, timeline_months: 8 },
    on_track: false,
    months_remaining: 8,
    projected_amount: 318000,
    success_probability: 61.5,
    recommended_adjustments: ["Move Rs 5,000 from dining and shopping into a liquid reserve each month."],
  },
];

export const mockTransactionSummary: TransactionSummary = {
  monthly_summary: [
    { month: "2026-01", income: 80000, expenses: 48000, savings: 32000 },
    { month: "2026-02", income: 82000, expenses: 50000, savings: 32000 },
    { month: "2026-03", income: 85000, expenses: 52000, savings: 33000 },
  ],
  category_totals: {
    food_dining: 15000,
    transport: 5000,
    subscriptions: 2400,
    rent_housing: 18000,
    groceries: 6200,
  },
  top_merchants: [
    { name: "Swiggy", total: 8500, count: 26 },
    { name: "Uber", total: 3200, count: 14 },
    { name: "Netflix", total: 649, count: 1 },
  ],
  recurring_expenses: [
    { merchant: "Netflix", amount: 649, frequency: "monthly" },
    { merchant: "Airtel", amount: 1299, frequency: "monthly" },
  ],
};
