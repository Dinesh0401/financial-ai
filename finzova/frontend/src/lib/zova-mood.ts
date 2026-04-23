import type { ZovaMood } from "@/components/zova-avatar";

const CONCERN_HINTS = [
  "critical",
  "overload",
  "fragile",
  "stress",
  "too high",
  "debt load",
  "high-interest",
  "burden",
  "warning",
  "default",
  "bankrupt",
  "crisis",
  "concern",
  "at risk",
  "at-risk",
  "danger",
  "trouble",
  "worry",
  "no data",
  "not available",
  "insights are limited",
  "please upload",
  "temporarily at capacity",
  "shortfall",
  "cannot afford",
  "can't afford",
  "can not afford",
  "below benchmark",
  "below safety",
  "emergency fund gap",
  "hard to",
  "tough at current",
  "under-insured",
  "over-leveraged",
  "needs a boost",
];

const HAPPY_HINTS = [
  "on track",
  "great",
  "strong",
  "healthy",
  "nice going",
  "well done",
  "congratulations",
  "good news",
  "achieved",
  "ahead of schedule",
  "you're doing well",
  "you are doing well",
  "keep going",
  "compound",
  "ready for",
  "debt-free",
  "debt free",
  "high chance",
  "plenty of room",
  "comfortable",
];

export function detectMood(text: string | undefined | null): ZovaMood {
  if (!text) return "idle";
  const lowered = text.toLowerCase();
  for (const hint of CONCERN_HINTS) {
    if (lowered.includes(hint)) return "concerned";
  }
  for (const hint of HAPPY_HINTS) {
    if (lowered.includes(hint)) return "happy";
  }
  return "idle";
}
