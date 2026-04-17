"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  GraduationCap,
  Heart,
  Home,
  Loader2,
  Plus,
  ShoppingBag,
  Sparkles,
  Target,
  Train,
  Trash2,
  TrendingUp,
  Tv,
  Utensils,
  Wallet,
  Zap,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { isAuthenticated } from "@/lib/auth";
import { createGoal, updateCurrentUser } from "@/lib/api";

gsap.registerPlugin(useGSAP);

/* ---------- types ---------- */

type IncomeData = {
  salary: string;
  freelance: string;
  rental: string;
  other: string;
};

type ExpenseData = {
  rent_housing: string;
  food_dining: string;
  transport: string;
  utilities: string;
  entertainment: string;
  shopping: string;
  healthcare: string;
  education: string;
  other: string;
};

type LoanEntry = {
  id: string;
  type: string;
  name: string;
  balance: string;
  emi: string;
  rate: string;
};

type GoalEntry = {
  id: string;
  name: string;
  priority: string;
  target: string;
  type: string;
};

const LOAN_TYPES = [
  "Home Loan",
  "Car Loan",
  "Personal Loan",
  "Education Loan",
  "Credit Card",
  "Gold Loan",
  "Two-Wheeler Loan",
  "Other",
];

const GOAL_TYPES = [
  { value: "emergency_fund", label: "Emergency Fund" },
  { value: "vehicle", label: "Vehicle" },
  { value: "home", label: "Home" },
  { value: "education", label: "Education" },
  { value: "retirement", label: "Retirement" },
  { value: "vacation", label: "Vacation" },
  { value: "wedding", label: "Wedding" },
  { value: "investment", label: "Investment" },
  { value: "debt_payoff", label: "Debt Payoff" },
  { value: "custom", label: "Custom" },
];

const STEPS = [
  { label: "INCOME", number: 1 },
  { label: "EXPENSES", number: 2 },
  { label: "LOANS", number: 3 },
  { label: "GOALS", number: 4 },
];

/* ---------- helpers ---------- */

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function parseNum(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/* ---------- components ---------- */

type DropdownOption = { value: string; label: string };

function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: r.left, width: r.width });
    }
    setOpen((v) => !v);
  }

  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`flex h-12 w-full items-center justify-between rounded-xl border bg-black/35 px-3 text-left text-sm text-white outline-none transition-colors focus:border-emerald-500/40 ${
          error ? "border-red-500/50" : "border-emerald-500/15"
        }`}
      >
        <span className={selected ? "text-white" : "text-white/40"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`size-4 text-white/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          ref={panelRef}
          className="fixed max-h-64 overflow-y-auto rounded-xl border border-emerald-500/20 bg-[#0c1220] p-1 shadow-[0_20px_45px_-15px_rgba(0,0,0,0.8)]"
          style={{ zIndex: 9999, top: pos.top, left: pos.left, width: pos.width }}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  active ? "bg-emerald-500/15 text-emerald-300" : "text-white/85 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>{o.label}</span>
                {active && <Check className="size-4" />}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center">
          {/* Circle */}
          <div className="flex flex-col items-center">
            <div
              className={`
                flex size-10 items-center justify-center rounded-full text-sm font-semibold transition-all duration-500
                ${
                  i < current
                    ? "bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                    : i === current
                      ? "bg-emerald-500 text-white shadow-[0_0_24px_rgba(16,185,129,0.5)] ring-2 ring-emerald-400/30 ring-offset-2 ring-offset-[#0c1220]"
                      : "border border-white/10 bg-white/5 text-white/30"
                }
              `}
            >
              {step.number}
            </div>
            <span
              className={`mt-2 text-[10px] font-semibold tracking-[0.15em] transition-colors duration-500 ${
                i <= current ? "text-emerald-400" : "text-white/20"
              }`}
            >
              {step.label}
            </span>
          </div>
          {/* Connector line */}
          {i < STEPS.length - 1 && (
            <div className="mx-1 mb-5 h-[2px] w-16 sm:w-24 md:w-32">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  background:
                    i < current
                      ? "linear-gradient(90deg, #10b981, #10b981)"
                      : "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.06))",
                }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FieldGroup({
  icon: Icon,
  label,
  value,
  onChange,
  placeholder,
  prefix,
  kind = "number",
  max,
  required = false,
  showRequiredError = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  prefix?: string;
  kind?: "number" | "text";
  max?: number;
  required?: boolean;
  showRequiredError?: boolean;
}) {
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);

  function handleChange(raw: string) {
    setTouched(true);
    if (kind === "text") {
      onChange(raw);
      return;
    }
    const hadInvalidChar = /[^0-9.]/.test(raw);
    const cleaned = raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    if (hadInvalidChar) {
      setError("Numbers only");
    } else if (cleaned && max !== undefined && Number(cleaned) > max) {
      setError(`Must be ≤ ${max}`);
    } else {
      setError("");
    }
    onChange(cleaned);
  }

  const isEmpty =
    !value.trim() || (kind === "number" && Number(value) <= 0);
  const requiredErr =
    required && isEmpty && (touched || showRequiredError)
      ? "This field is required"
      : "";
  const displayError = error || requiredErr;

  return (
    <div data-animate="field" className="space-y-1.5">
      <label className="flex items-center gap-1 text-xs font-medium tracking-wide text-white/50">
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      <div
        className={`group relative flex items-center overflow-hidden rounded-xl border bg-white/[0.03] transition-all focus-within:bg-white/[0.05] ${
          displayError
            ? "border-red-500/50 focus-within:border-red-500/60 focus-within:shadow-[0_0_20px_rgba(239,68,68,0.12)]"
            : "border-white/[0.06] focus-within:border-emerald-500/40 focus-within:shadow-[0_0_20px_rgba(16,185,129,0.08)]"
        }`}
      >
        <div className="flex size-10 shrink-0 items-center justify-center text-white/25 group-focus-within:text-emerald-400/60">
          {prefix ? <span className="text-base">{prefix}</span> : <Icon className="size-4" />}
        </div>
        <input
          type="text"
          inputMode={kind === "number" ? "decimal" : "text"}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          className="h-12 w-full bg-transparent pr-4 text-sm text-white outline-none placeholder:text-white/20"
        />
      </div>
      {displayError && <p className="text-xs text-red-400">{displayError}</p>}
    </div>
  );
}

/* ---------- step panels ---------- */

function StepIncome({
  data,
  onChange,
  showErrors,
}: {
  data: IncomeData;
  onChange: (d: IncomeData) => void;
  showErrors: boolean;
}) {
  const total =
    parseNum(data.salary) +
    parseNum(data.freelance) +
    parseNum(data.rental) +
    parseNum(data.other);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Monthly Income</h2>
        <p className="mt-1 text-sm text-white/40">
          Let&apos;s start with what you bring home every month.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FieldGroup
          icon={Wallet}
          label="Salary (Net)"
          value={data.salary}
          onChange={(v) => onChange({ ...data, salary: v })}
          placeholder="e.g. 80000"
          prefix="₹"
          required
          showRequiredError={showErrors}
        />
        <FieldGroup
          icon={BriefcaseBusiness}
          label="Freelance / Side Hustle"
          value={data.freelance}
          onChange={(v) => onChange({ ...data, freelance: v })}
          placeholder="e.g. 15000"
        />
        <FieldGroup
          icon={Home}
          label="Rental Income"
          value={data.rental}
          onChange={(v) => onChange({ ...data, rental: v })}
          placeholder="e.g. 10000"
        />
        <FieldGroup
          icon={Plus}
          label="Other Income"
          value={data.other}
          onChange={(v) => onChange({ ...data, other: v })}
          placeholder="Dividends, interest, etc."
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-3">
        <span className="text-sm font-medium text-emerald-400">Total Monthly Income</span>
        <span className="text-xl font-bold text-emerald-300">
          ₹{total.toLocaleString("en-IN")}
        </span>
      </div>
    </div>
  );
}

function StepExpenses({
  data,
  onChange,
  totalIncome,
}: {
  data: ExpenseData;
  onChange: (d: ExpenseData) => void;
  totalIncome: number;
}) {
  const fields: {
    key: keyof ExpenseData;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { key: "rent_housing", label: "Rent / Housing", icon: Home },
    { key: "food_dining", label: "Food & Dining", icon: Utensils },
    { key: "transport", label: "Transport", icon: Train },
    { key: "utilities", label: "Utilities", icon: Zap },
    { key: "entertainment", label: "Entertainment", icon: Tv },
    { key: "shopping", label: "Shopping", icon: ShoppingBag },
    { key: "healthcare", label: "Healthcare", icon: Heart },
    { key: "education", label: "Education", icon: GraduationCap },
    { key: "other", label: "Other", icon: Plus },
  ];

  const totalExpenses = Object.values(data).reduce((s, v) => s + parseNum(v), 0);
  const surplus = totalIncome - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Monthly Expenses</h2>
          <p className="mt-1 text-sm text-white/40">
            Track where your money goes to optimize savings.
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-right">
          <span className="text-[10px] font-medium tracking-wider text-white/40">Surplus</span>
          <p className={`text-lg font-bold ${surplus >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            ₹{surplus.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <FieldGroup
            key={f.key}
            icon={f.icon}
            label={f.label}
            value={data[f.key]}
            onChange={(v) => onChange({ ...data, [f.key]: v })}
            placeholder="0"
          />
        ))}
      </div>
    </div>
  );
}

function StepLoans({
  loans,
  onChange,
  showErrors,
}: {
  loans: LoanEntry[];
  onChange: (l: LoanEntry[]) => void;
  showErrors: boolean;
}) {
  function addLoan() {
    onChange([
      ...loans,
      { id: uid(), type: "", name: "", balance: "", emi: "", rate: "" },
    ]);
  }

  function updateLoan(id: string, patch: Partial<LoanEntry>) {
    onChange(loans.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeLoan(id: string) {
    onChange(loans.filter((l) => l.id !== id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Active Loans & Debt</h2>
        <p className="mt-1 text-sm text-white/40">
          Optional — skip this step if you have no active loans. Listing them unlocks an AI-optimized payoff strategy.
        </p>
      </div>

      {loans.map((loan) => (
        <div
          key={loan.id}
          className="relative space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <button
            type="button"
            onClick={() => removeLoan(loan.id)}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/5 hover:text-red-400"
          >
            <Trash2 className="size-4" />
          </button>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide text-white/50">Loan Type</label>
              <Dropdown
                value={loan.type}
                onChange={(v) => updateLoan(loan.id, { type: v })}
                options={LOAN_TYPES.map((t) => ({ value: t, label: t }))}
                placeholder="Select an option"
              />
            </div>
            <FieldGroup
              icon={CreditCard}
              label="Loan Name"
              value={loan.name}
              onChange={(v) => updateLoan(loan.id, { name: v })}
              placeholder="e.g., SBI Home Loan"
              kind="text"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <FieldGroup
              icon={Banknote}
              label="Outstanding Balance"
              value={loan.balance}
              onChange={(v) => updateLoan(loan.id, { balance: v })}
              placeholder="Outstanding Balance"
              prefix="₹"
            />
            <FieldGroup
              icon={Banknote}
              label="Monthly EMI"
              value={loan.emi}
              onChange={(v) => updateLoan(loan.id, { emi: v })}
              placeholder="Monthly EMI"
              prefix="₹"
            />
            <FieldGroup
              icon={TrendingUp}
              label="Interest Rate %"
              value={loan.rate}
              onChange={(v) => updateLoan(loan.id, { rate: v })}
              placeholder="e.g. 8.5"
              max={100}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addLoan}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-4 text-sm text-white/30 transition-colors hover:border-emerald-500/30 hover:text-emerald-400"
      >
        <Plus className="size-4" />
        Add Another Loan
      </button>
    </div>
  );
}

function StepGoals({
  goals,
  onChange,
  showErrors,
}: {
  goals: GoalEntry[];
  onChange: (g: GoalEntry[]) => void;
  showErrors: boolean;
}) {
  function addGoal() {
    onChange([
      ...goals,
      { id: uid(), name: "", priority: "medium", target: "", type: "custom" },
    ]);
  }

  function updateGoal(id: string, patch: Partial<GoalEntry>) {
    onChange(goals.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function removeGoal(id: string) {
    onChange(goals.filter((g) => g.id !== id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Financial Goals</h2>
        <p className="mt-1 text-sm text-white/40">
          What are you saving for? Let AI map your timeline.
        </p>
      </div>

      {goals.map((goal) => (
        <div
          key={goal.id}
          className="relative space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <button
            type="button"
            onClick={() => removeGoal(goal.id)}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/5 hover:text-red-400"
          >
            <Trash2 className="size-4" />
          </button>

          <div className="grid gap-3 sm:grid-cols-2">
            <FieldGroup
              icon={Target}
              label="Goal Name"
              value={goal.name}
              onChange={(v) => updateGoal(goal.id, { name: v })}
              placeholder="e.g. House Downpayment"
              kind="text"
              required
              showRequiredError={showErrors}
            />
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide text-white/50">Priority</label>
              <Dropdown
                value={goal.priority}
                onChange={(v) => updateGoal(goal.id, { priority: v })}
                options={[
                  { value: "high", label: "High Priority" },
                  { value: "medium", label: "Medium Priority" },
                  { value: "low", label: "Low Priority" },
                ]}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldGroup
              icon={Banknote}
              label="Target Amount"
              value={goal.target}
              onChange={(v) => updateGoal(goal.id, { target: v })}
              placeholder="500000"
              prefix="₹"
              required
              showRequiredError={showErrors}
            />
            <div className="space-y-1.5">
              <label className="text-xs font-medium tracking-wide text-white/50">Goal Type</label>
              <Dropdown
                value={goal.type}
                onChange={(v) => updateGoal(goal.id, { type: v })}
                options={GOAL_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addGoal}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-4 text-sm text-white/30 transition-colors hover:border-emerald-500/30 hover:text-emerald-400"
      >
        <Plus className="size-4" />
        Add Another Goal
      </button>
    </div>
  );
}

/* ---------- main page ---------- */

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Page entrance animation
  useGSAP(
    () => {
      if (!pageRef.current) return;

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      const title = pageRef.current.querySelector("[data-animate='title']");
      const indicator = pageRef.current.querySelector("[data-animate='indicator']");
      const card = pageRef.current.querySelector("[data-animate='card']");
      const footer = pageRef.current.querySelector("[data-animate='footer']");

      if (title) tl.fromTo(title, { autoAlpha: 0, y: -20 }, { autoAlpha: 1, y: 0, duration: 0.6 });
      if (indicator) tl.fromTo(indicator, { autoAlpha: 0, y: -10, scale: 0.95 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.5 }, "-=0.3");
      if (card) tl.fromTo(card, { autoAlpha: 0, y: 40, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.7 }, "-=0.3");
      if (footer) tl.fromTo(footer, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, "-=0.2");
    },
    { scope: pageRef },
  );

  // Step transition animation
  useGSAP(
    () => {
      if (!cardRef.current) return;

      const fields = cardRef.current.querySelectorAll("[data-animate='field']");
      const nav = cardRef.current.querySelector("[data-animate='nav']");

      gsap.fromTo(
        cardRef.current,
        { autoAlpha: 0.6, x: 40 },
        { autoAlpha: 1, x: 0, duration: 0.45, ease: "power3.out" },
      );

      if (fields.length > 0) {
        gsap.fromTo(
          Array.from(fields),
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.04, ease: "power2.out", delay: 0.1 },
        );
      }

      if (nav) {
        gsap.fromTo(nav, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, delay: 0.25 });
      }
    },
    { scope: cardRef, dependencies: [step], revertOnUpdate: true },
  );

  const [income, setIncome] = useState<IncomeData>({
    salary: "",
    freelance: "",
    rental: "",
    other: "",
  });

  const [expenses, setExpenses] = useState<ExpenseData>({
    rent_housing: "",
    food_dining: "",
    transport: "",
    utilities: "",
    entertainment: "",
    shopping: "",
    healthcare: "",
    education: "",
    other: "",
  });

  const [loans, setLoans] = useState<LoanEntry[]>([
    { id: uid(), type: "", name: "", balance: "", emi: "", rate: "" },
  ]);

  const [goals, setGoals] = useState<GoalEntry[]>([
    { id: uid(), name: "", priority: "high", target: "", type: "emergency_fund" },
  ]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalIncome =
    parseNum(income.salary) +
    parseNum(income.freelance) +
    parseNum(income.rental) +
    parseNum(income.other);

  function validateCurrentStep(): boolean {
    if (step === 0) {
      return parseNum(income.salary) > 0;
    }
    if (step === 2) {
      return true;
    }
    if (step === 3) {
      return goals.every(
        (g) => g.name.trim().length > 0 && parseNum(g.target) > 0,
      );
    }
    return true;
  }

  function next() {
    if (!validateCurrentStep()) {
      setShowErrors(true);
      setError("Please fill all required fields marked with *.");
      return;
    }
    setShowErrors(false);
    setError("");
    if (step < 3) setStep(step + 1);
  }

  function back() {
    setShowErrors(false);
    setError("");
    if (step > 0) setStep(step - 1);
  }

  async function handleSubmit() {
    if (!validateCurrentStep()) {
      setShowErrors(true);
      setError("Please fill all required fields marked with *.");
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      // 1. Save profile with total income
      await updateCurrentUser({
        monthly_income: totalIncome || null,
        onboarding_done: true,
      });

      // 2. Create goals from Step 4
      for (const goal of goals) {
        const targetAmount = parseNum(goal.target);
        if (goal.name.trim() && targetAmount > 0) {
          const timelineMonths =
            goal.priority === "high" ? 12 : goal.priority === "medium" ? 24 : 36;
          try {
            await createGoal({
              goal_type: goal.type,
              title: goal.name.trim(),
              target_amount: targetAmount,
              timeline_months: timelineMonths,
              current_amount: 0,
            });
          } catch {
            // skip individual goal errors
          }
        }
      }

      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div
      ref={pageRef}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#010401]"
    >
      {/* Background glow effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,_rgba(16,185,129,0.24),_transparent_28%),radial-gradient(circle_at_82%_14%,_rgba(34,197,94,0.18),_transparent_24%),linear-gradient(180deg,_rgba(4,24,10,0.72)_0%,_rgba(1,4,1,0.92)_38%,_rgba(0,0,0,1)_100%)]" />
        <div className="absolute left-[8%] top-[-12%] h-[620px] w-[620px] rounded-full bg-emerald-400/[0.18] blur-[160px]" />
        <div className="absolute bottom-[-14%] right-[8%] h-[540px] w-[540px] rounded-full bg-green-500/[0.14] blur-[150px]" />
        <div className="absolute inset-0 opacity-[0.34]" style={{ backgroundImage: "linear-gradient(rgba(34,197,94,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.09) 1px, transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(circle at center, black 34%, transparent 92%)" }} />
      </div>

      <div className="relative z-10 w-full max-w-3xl px-4 py-12">
        {/* Title */}
        <h1 data-animate="title" className="mb-10 text-center text-3xl font-bold tracking-tight text-white md:text-4xl">
          Your Financial Foundation
        </h1>

        {/* Step indicator */}
        <div data-animate="indicator" className="mb-10">
          <StepIndicator current={step} />
        </div>

        {/* Card */}
        <div
          ref={cardRef}
          data-animate="card"
          className="rounded-3xl border border-emerald-500/12 bg-black/38 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.62),inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur-xl sm:p-8"
        >
          {step === 0 && <StepIncome data={income} onChange={setIncome} showErrors={showErrors} />}
          {step === 1 && (
            <StepExpenses data={expenses} onChange={setExpenses} totalIncome={totalIncome} />
          )}
          {step === 2 && <StepLoans loans={loans} onChange={setLoans} showErrors={showErrors} />}
          {step === 3 && <StepGoals goals={goals} onChange={setGoals} showErrors={showErrors} />}

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div data-animate="nav" className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              disabled={step === 0}
              className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                step === 0
                  ? "cursor-not-allowed text-white/10"
                  : "text-white/40 hover:text-white"
              }`}
            >
              <ChevronLeft className="size-4" />
              Back
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={next}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-7 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_32px_rgba(16,185,129,0.4)] active:scale-[0.97]"
              >
                Continue
                <ChevronRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-7 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_32px_rgba(16,185,129,0.4)] active:scale-[0.97] disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generating AI Plan...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Generate AI Plan
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <p data-animate="footer" className="mt-6 text-center text-xs text-white/15">
          Your data is encrypted and never shared. Powered by 6 autonomous AI agents.
        </p>
      </div>

    </div>
  );
}
