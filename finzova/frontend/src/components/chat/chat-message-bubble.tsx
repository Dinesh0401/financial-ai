"use client";

import * as React from "react";
import { ChevronRight, MessageSquareQuote, Sparkles, User2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ZovaAvatar } from "@/components/zova-avatar";
import { detectMood } from "@/lib/zova-mood";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  agents?: string[];
};

type ChatMessageBubbleProps = {
  message: ChatMessage;
};

function formatAgentLabel(agent: string): string {
  return agent
    .replace(/[_-]+/g, " ")
    .replace(/\bagent\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeSentence(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function formatInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;

  text.replace(pattern, (match, _group, offset) => {
    if (offset > lastIndex) {
      parts.push(<span key={`text-${parts.length}`}>{text.slice(lastIndex, offset)}</span>);
    }

    if (match.startsWith("**")) {
      const value = match.slice(2, -2);
      parts.push(
        <strong key={`strong-${parts.length}`} className="font-semibold text-foreground">
          {value}
        </strong>,
      );
    } else if (match.startsWith("`")) {
      const value = match.slice(1, -1);
      parts.push(
        <code
          key={`code-${parts.length}`}
          className="rounded-md border border-border/60 bg-background/80 px-1.5 py-0.5 font-mono text-[0.8em] text-foreground"
        >
          {value}
        </code>,
      );
    } else if (match.startsWith("~~")) {
      const value = match.slice(2, -2);
      parts.push(
        <span key={`strike-${parts.length}`} className="text-foreground/60 line-through">
          {value}
        </span>,
      );
    } else if (match.startsWith("[")) {
      const linkMatch = match.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        parts.push(
          <a
            key={`link-${parts.length}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary underline decoration-primary/40 underline-offset-4 transition hover:decoration-primary"
          >
            {label}
            <ChevronRight className="size-3" />
          </a>,
        );
      }
    } else {
      const value = match.slice(1, -1);
      parts.push(
        <em key={`em-${parts.length}`} className="not-italic text-foreground/90">
          {value}
        </em>,
      );
    }

    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < text.length) {
    parts.push(<span key={`text-${parts.length}`}>{text.slice(lastIndex)}</span>);
  }

  return parts;
}

function isHeadingLine(line: string): boolean {
  if (!line) return false;
  if (line.startsWith("#")) return true;
  if (/^\*\*.+\*\*:?\s*$/.test(line)) return true;
  if (/^(key findings|agent recommendations|recommended investment mix|instrument suitability|guardrails|monthly plan|allocations?|recommendation|summary|next steps|how to ask|why this won|why it won|confidence|evidence|takeaway)\s*:?\s*$/i.test(line)) {
    return true;
  }
  return /^[A-Z][A-Za-z0-9 /&()-]{2,40}:$/.test(line);
}

function stripHeadingSyntax(line: string): string {
  return line.replace(/^#{1,3}\s+/, "").replace(/^\*\*(.+)\*\*:?\s*$/, "$1").replace(/:\s*$/, "");
}

type Block =
  | { type: "heading"; value: string }
  | { type: "paragraph"; value: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "callout"; value: string }
  | { type: "separator" };

function parseBlocks(content: string): Block[] {
  const lines = content.split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: "paragraph", value: paragraph.join(" ") });
      paragraph = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: "list", ordered: listOrdered, items: listItems });
      listItems = [];
      listOrdered = false;
    }
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushAll();
      continue;
    }

    const bulletMatch = line.match(/^[-*\u2022]\s+(.+)$/);
    if (bulletMatch?.[1]) {
      flushParagraph();
      if (listItems.length > 0 && listOrdered) {
        flushList();
      }
      listOrdered = false;
      listItems.push(bulletMatch[1].trim());
      continue;
    }

    const orderedMatch = line.match(/^(?:\d+)[.)]\s+(.+)$/);
    if (orderedMatch?.[1]) {
      flushParagraph();
      if (listItems.length > 0 && !listOrdered) {
        flushList();
      }
      listOrdered = true;
      listItems.push(orderedMatch[1].trim());
      continue;
    }

    if (line.startsWith(">")) {
      flushAll();
      blocks.push({ type: "callout", value: line.replace(/^>\s?/, "") });
      continue;
    }

    if (/^[-_]{3,}$/.test(line)) {
      flushAll();
      blocks.push({ type: "separator" });
      continue;
    }

    if (isHeadingLine(line)) {
      flushAll();
      blocks.push({ type: "heading", value: stripHeadingSyntax(line) });
      continue;
    }

    paragraph.push(line);
  }

  flushAll();
  return blocks;
}

function RichContent({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <div
              key={`${block.type}-${index}`}
              className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-primary"
            >
              <span className="size-1.5 rounded-full bg-primary" />
              {block.value}
            </div>
          );
        }

        if (block.type === "callout") {
          return (
            <div
              key={`${block.type}-${index}`}
              className="rounded-3xl border border-primary/18 bg-gradient-to-br from-primary/10 via-background/50 to-background/30 px-4 py-3 text-sm leading-7 text-foreground/92 shadow-[0_12px_35px_-28px_rgba(0,0,0,0.55)]"
            >
              {formatInline(block.value)}
            </div>
          );
        }

        if (block.type === "separator") {
          return <div key={`${block.type}-${index}`} className="h-px w-full bg-gradient-to-r from-transparent via-border/80 to-transparent" />;
        }

        if (block.type === "list") {
          return (
            <ol key={`${block.type}-${index}`} className="space-y-2 rounded-3xl border border-border/50 bg-background/25 px-4 py-3">
              {block.items.map((item, itemIndex) => (
                <li key={`${index}-${itemIndex}`} className="flex gap-3">
                  <span
                    className={cn(
                      "mt-1.5 shrink-0 text-xs font-medium uppercase tracking-[0.2em]",
                      block.ordered ? "w-5 text-center text-primary" : "size-2 rounded-full bg-primary",
                    )}
                  >
                    {block.ordered ? `${itemIndex + 1}.` : null}
                  </span>
                  <span className="min-w-0 flex-1 text-foreground/90">{formatInline(item)}</span>
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={`${block.type}-${index}`} className="leading-7 text-foreground/90">
            {formatInline(normalizeSentence(block.value))}
          </p>
        );
      })}
    </div>
  );
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  if (message.role === "user") {
    return (
      <div className="ml-auto flex max-w-[92%] justify-end">
        <div className="rounded-[28px] border border-primary/20 bg-gradient-to-br from-primary/18 via-primary/12 to-primary/8 px-4 py-3 text-sm leading-7 text-foreground shadow-[0_12px_40px_-24px_rgba(0,0,0,0.6)]">
          <div className="mb-2 flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.24em] text-primary/80">
            <User2 className="size-3.5" />
            You
          </div>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  const mood = detectMood(message.content);
  const moodLabel =
    mood === "happy"
      ? "Good news"
      : mood === "concerned"
        ? "Heads up"
        : "Your money sidekick";
  const moodBadgeClass =
    mood === "happy"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
      : mood === "concerned"
        ? "border-amber-400/30 bg-amber-500/10 text-amber-300"
        : "border-primary/20 bg-primary/10 text-primary";

  return (
    <article className="max-w-[96%] overflow-hidden rounded-[30px] border border-border/60 bg-card/90 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.65)] backdrop-blur-xl">
      <div className="flex items-start gap-3 border-b border-border/50 px-4 py-4">
        <ZovaAvatar size={40} mood={mood} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">Zova</p>
            <Badge
              variant="outline"
              className={`rounded-full text-[10px] uppercase tracking-[0.24em] ${moodBadgeClass}`}
            >
              {moodLabel}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Personal advice pulled from your actual income, spends and loans.</p>
        </div>
      </div>

      <div className="space-y-5 px-4 py-4">
        <RichContent content={message.content} />
      </div>

      <div className="border-t border-border/50 bg-background/25 px-4 py-3">
        {message.agents && message.agents.length > 0 ? (
          <>
            <div className="mb-2 flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.24em] text-muted-foreground">
              <MessageSquareQuote className="size-3.5 text-primary" />
              Agents engaged
            </div>
            <div className="flex flex-wrap gap-2">
              {message.agents.map((agent) => (
                <Badge
                  key={agent}
                  variant="outline"
                  className="rounded-full border-border/70 bg-card/80 px-3 py-1 text-[11px] font-medium text-foreground"
                >
                  {formatAgentLabel(agent)}
                </Badge>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Financial response synthesized from live account context.
          </div>
        )}
      </div>
    </article>
  );
}

export function ChatThinkingCard({
  text,
  activeAgents,
}: {
  text: string;
  activeAgents: string[];
}) {
  return (
    <div className="max-w-[96%] rounded-[28px] border border-primary/20 bg-gradient-to-br from-primary/10 via-background/65 to-background/35 px-4 py-4 text-sm text-foreground/90 shadow-[0_18px_45px_-35px_rgba(0,0,0,0.7)]">
      <div className="flex items-center gap-3">
        <ZovaAvatar size={32} mood="thinking" />
        <div className="flex flex-col">
          <span className="text-[0.72rem] uppercase tracking-[0.24em] text-primary">Zova is thinking…</span>
        </div>
      </div>
      <p className="mt-3 leading-7">{text}</p>
      {activeAgents.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeAgents.map((agent) => (
            <Badge
              key={agent}
              variant="outline"
              className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-[11px] text-primary"
            >
              {formatAgentLabel(agent)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
