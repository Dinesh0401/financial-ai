"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, Bot, HelpCircle, Mail, MessageCircleQuestion, Upload, X } from "lucide-react";

import { cn } from "@/lib/utils";

type Topic = {
  icon: typeof HelpCircle;
  title: string;
  body: string;
  href?: string;
};

const TOPICS: Topic[] = [
  {
    icon: BookOpen,
    title: "New here? Read the walkthrough",
    body: "A 7-step guided tour covering sign-in, uploads, goals and asking Zova.",
    href: "/guide",
  },
  {
    icon: Upload,
    title: "Upload isn't reading my statement",
    body: "Export CSV from your bank app (not PDF screenshots). For UPI PDFs, unlock with your statement password first.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Zova says 'temporarily at capacity'",
    body: "Our AI is rate-limited per minute. Wait ~30 seconds and ask again — one focused question at a time works best.",
  },
  {
    icon: HelpCircle,
    title: "My numbers look wrong",
    body: "Re-upload the latest statement — duplicates are skipped automatically. Then check 'My Money Story' for the refreshed view.",
  },
];

const QUICK_CHAT_PROMPTS = [
  "Can I buy a bike?",
  "How fast can I close my loan?",
  "What should I do first this month?",
];

export function SupportWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close help" : "Open help"}
        className={cn(
          "fixed bottom-20 right-4 z-[90] flex size-14 items-center justify-center rounded-full border border-primary/40 bg-primary text-primary-foreground shadow-[0_18px_45px_-12px_rgba(0,0,0,0.7)] transition hover:scale-105 sm:bottom-5 sm:right-5",
          open && "bg-background text-foreground",
        )}
      >
        {open ? <X className="size-5" /> : <Bot className="size-6" />}
      </button>

      {open && (
        <div className="fixed bottom-[9rem] right-4 z-[90] w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-border/70 bg-card/95 shadow-[0_28px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl sm:right-5 sm:bottom-[5.5rem]">
          <div className="border-b border-border/60 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent px-5 py-4">
            <div className="flex items-center gap-2 text-primary">
              <Bot className="size-4" />
              <p className="text-xs uppercase tracking-[0.28em]">Ask Zova</p>
            </div>
            <h3 className="mt-2 text-lg font-semibold">Quick money help</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Ask a ready-made question or open support help.
            </p>
          </div>

          <div className="max-h-[min(60vh,440px)] space-y-2 overflow-y-auto p-3">
            <div className="rounded-2xl border border-primary/25 bg-primary/10 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Floating chatbot</p>
              <div className="mt-2 space-y-1.5">
                {QUICK_CHAT_PROMPTS.map((q) => (
                  <Link
                    key={q}
                    href={`/chat?q=${encodeURIComponent(q)}&send=1`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/45 px-3 py-2 text-sm text-foreground transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <Bot className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{q}</span>
                  </Link>
                ))}
              </div>
            </div>

            <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Support topics</p>
            {TOPICS.map(({ icon: Icon, title, body, href }) => {
              const content = (
                <div className="flex gap-3 rounded-2xl border border-border/50 bg-background/40 px-3 py-3 transition hover:border-primary/40 hover:bg-primary/5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
                  </div>
                </div>
              );
              return href ? (
                <Link key={title} href={href} onClick={() => setOpen(false)}>
                  {content}
                </Link>
              ) : (
                <div key={title}>{content}</div>
              );
            })}

            <a
              href="mailto:support@finzova.org?subject=Finzova%20support%20request"
              className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-3 text-sm text-primary transition hover:bg-primary/15"
            >
              <Mail className="size-4" />
              <span className="flex-1">Still stuck? Email support@finzova.org</span>
            </a>
          </div>
        </div>
      )}
    </>
  );
}
