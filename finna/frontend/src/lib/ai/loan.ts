export type LoanInputs = {
  principal: number;
  annualRatePct: number;
  emi: number;
};

function monthsToClose(principal: number, monthlyRate: number, emi: number): number {
  if (emi <= principal * monthlyRate) return Infinity;
  const n = Math.log(emi / (emi - principal * monthlyRate)) / Math.log(1 + monthlyRate);
  return Math.ceil(n);
}

export type LoanOptimization = {
  currentMonths: number;
  boostedEmi: number;
  boostedMonths: number;
  monthsSaved: number;
  interestSavedApprox: number;
};

export function optimizeLoan({ principal, annualRatePct, emi }: LoanInputs): LoanOptimization | null {
  if (principal <= 0 || emi <= 0 || annualRatePct <= 0) return null;
  const r = annualRatePct / 12 / 100;
  const currentMonths = monthsToClose(principal, r, emi);
  if (!Number.isFinite(currentMonths)) return null;
  const boostedEmi = Math.round(emi * 1.2);
  const boostedMonths = monthsToClose(principal, r, boostedEmi);
  const monthsSaved = Math.max(0, currentMonths - boostedMonths);
  const interestSavedApprox = Math.max(0, emi * currentMonths - boostedEmi * boostedMonths);
  return { currentMonths, boostedEmi, boostedMonths, monthsSaved, interestSavedApprox };
}
