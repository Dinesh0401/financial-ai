"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Bot, Loader2, Sparkles, User2 } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { AppShell } from "@/components/app-shell";
import { ChatMessageBubble, ChatThinkingCard } from "@/components/chat/chat-message-bubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL } from "@/lib/api";
import { getToken, isAuthenticated } from "@/lib/auth";

gsap.registerPlugin(useGSAP);

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
  agents?: string[];
};

const STARTER_PROMPTS = [
  { label: "Where am I overspending this month?", emoji: "🔍" },
  { label: "How do I pay off my highest-interest loan faster?", emoji: "💳" },
  { label: "Am I saving enough for my house goal?", emoji: "🏠" },
  { label: "What tax savings am I missing?", emoji: "💰" },
  { label: "Should I invest more or clear debt first?", emoji: "⚖️" },
  { label: "Give me a 30-second financial health check.", emoji: "❤️" },
];

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatPageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!chatPageRef.current) return;
      const welcome = chatPageRef.current.querySelector("[data-animate='welcome']");
      if (welcome) {
        gsap.fromTo(welcome, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" });
      }
    },
    { scope: chatPageRef, dependencies: [messages.length === 0] },
  );

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
    }
  }, [router]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingText]);

  async function submitPrompt(value: string) {
    if (!value.trim() || streaming) return;

    const token = getToken();
    if (!token) {
      router.push("/login");
      return;
    }

    const userMessage: Message = { role: "user", content: value };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStreaming(true);
    setThinkingText("");
    setActiveAgents([]);

    let assistantContent = "";

    try {
      const response = await fetch(`${API_BASE_URL}/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: value }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err || `Error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;

        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) continue;
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.thought) setThinkingText(data.thought);

            if (data.agent && data.tool && !data.content) {
              setActiveAgents((prev) => (prev.includes(data.agent) ? prev : [...prev, data.agent]));
            }

            if (data.content) {
              assistantContent += data.content;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant" && last !== userMessage) {
                  last.content = assistantContent;
                  return [...updated];
                }
                return [...updated, { role: "assistant", content: assistantContent }];
              });
            }

            if (data.session_id && data.tools_used) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") last.agents = data.tools_used;
                return [...updated];
              });
            }
          } catch {
            // Ignore malformed SSE chunks
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Connection failed";
      if (!assistantContent) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `The AI service is temporarily at capacity. Please try again in a moment.\n\nTechnical note: ${errorMsg}`,
          },
        ]);
      }
    } finally {
      setStreaming(false);
      setThinkingText("");
      setActiveAgents([]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitPrompt(input);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <AppShell>
      <div ref={chatPageRef} className="mx-auto flex h-[calc(100vh-6rem)] w-full max-w-3xl flex-col">
        {/* Scroll area */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2">
          {isEmpty ? (
            <div data-animate="welcome" className="flex min-h-full flex-col items-center justify-center py-10 text-center">
              <div className="flex size-16 items-center justify-center rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-primary">
                <Bot className="size-8" />
              </div>
              <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
                How can I help with your money today?
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
                I'm your AI Copilot, powered by 6 specialist agents. I know your transactions, goals, and risk profile —
                so I can give you answers that are actually about you.
              </p>

              <div className="mt-10 grid w-full gap-3 sm:grid-cols-2">
                {STARTER_PROMPTS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => submitPrompt(p.label)}
                    disabled={streaming}
                    className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3 text-left text-sm leading-6 text-foreground/85 transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:opacity-50"
                  >
                    <span className="text-lg">{p.emoji}</span>
                    <span className="flex-1">{p.label}</span>
                  </button>
                ))}
              </div>

              <p className="mt-8 text-xs text-muted-foreground">
                Tip: ask one focused question at a time for the sharpest answer.
              </p>
            </div>
          ) : (
            <div className="space-y-5 py-4">
              {messages.map((message, index) => (
                <ChatMessageBubble
                  key={`${message.role}-${index}`}
                  message={{ role: message.role, content: message.content, agents: message.agents }}
                />
              ))}

              {streaming && thinkingText && (
                <ChatThinkingCard text={thinkingText} activeAgents={activeAgents} />
              )}

              <div ref={scrollRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="sticky bottom-0 border-t border-border/40 bg-background/90 pb-4 pt-3 backdrop-blur-xl">
          <div className="relative flex items-end gap-2 rounded-[28px] border border-border/60 bg-card/80 px-3 py-2 shadow-[0_18px_45px_-30px_rgba(0,0,0,0.6)] focus-within:border-primary/40">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User2 className="size-4" />
            </div>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message your AI Copilot..."
              className="min-h-[44px] flex-1 resize-none border-0 bg-transparent px-1 py-2 shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
              disabled={streaming}
              rows={1}
            />
            <Button
              onClick={() => submitPrompt(input)}
              disabled={streaming || !input.trim()}
              size="icon"
              className="size-10 shrink-0 rounded-full"
            >
              {streaming ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </Button>
          </div>
          <p className="mt-2 px-2 text-center text-[10px] text-muted-foreground">
            <Sparkles className="mr-1 inline size-3 text-primary" />
            Powered by 6 autonomous AI agents · Responses reflect your actual financial data
          </p>
        </div>
      </div>
    </AppShell>
  );
}
