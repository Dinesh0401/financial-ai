"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Bot, Brain, Cpu, Loader2, Radar, SendHorizontal, Sparkles, Target, TrendingUp, Zap } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { AppShell } from "@/components/app-shell";

gsap.registerPlugin(useGSAP);
import { AgentStatusCard } from "@/components/chat/agent-status-card";
import { ChatMessageBubble, ChatThinkingCard } from "@/components/chat/chat-message-bubble";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL } from "@/lib/api";
import { getToken, isAuthenticated } from "@/lib/auth";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
  agents?: string[];
};

type AgentDescriptor = {
  name: string;
  icon: ComponentType<{ className?: string }>;
  desc: string;
};

const prompts = [
  "Can I afford a car worth Rs 5 lakh in 3 years?",
  "Where is my biggest spending leak this month?",
  "How much should I move into an emergency fund next?",
  "Give me a full financial health check.",
  "What tax-saving opportunities am I missing?",
  "Should I increase my SIP or pay off debt first?",
];

const agentInfo: AgentDescriptor[] = [
  { name: "Expense Agent", icon: Brain, desc: "Classifies spending and detects anomalies" },
  { name: "Debt Agent", icon: Cpu, desc: "Optimizes loan repayment strategy" },
  { name: "Goal Agent", icon: Target, desc: "Simulates goal probability" },
  { name: "Risk Agent", icon: Radar, desc: "Monitors financial risk signals" },
  { name: "Investment Agent", icon: TrendingUp, desc: "Evaluates portfolio allocation" },
  { name: "Tax Agent", icon: Zap, desc: "Identifies tax-saving opportunities" },
];

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I'm your Financial Assistant and future money saver, powered by 6 specialist agents. Ask me about spending, goals, investments, tax savings, or financial health, and I will run a real-time multi-agent analysis on your data.",
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatPageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!chatPageRef.current) return;
      const cards = chatPageRef.current.querySelectorAll("[data-animate='card']");
      if (cards.length === 0) return;
      gsap.fromTo(
        Array.from(cards),
        { autoAlpha: 0, y: 28, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.6, stagger: 0.12, ease: "power3.out" },
      );
    },
    { scope: chatPageRef },
  );

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

            if (data.thought) {
              setThinkingText(data.thought);
            }

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
                if (last?.role === "assistant") {
                  last.agents = data.tools_used;
                }
                return [...updated];
              });
            }
          } catch {
            // Ignore malformed SSE chunks.
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
            content: `I ran multi-agent analysis on your query but the AI service is temporarily at capacity. Here's what I can tell you based on rule-based analysis:\n\nThe specialist agents processed your financial data. Please try again in a moment for a detailed AI-generated response.\n\nTechnical note: ${errorMsg}`,
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

  return (
    <AppShell>
      <div ref={chatPageRef} className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card data-animate="card" className="overflow-hidden border-border/60 bg-card/80 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.75)] backdrop-blur-xl">
          <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-transparent to-transparent pb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Bot className="size-5 text-primary" />
                  <p className="text-xs uppercase tracking-[0.3em] text-primary">AI Copilot</p>
                </div>
                <CardTitle className="text-2xl sm:text-3xl">Multi-Agent Workspace</CardTitle>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                  Ask about spending, goals, investments, tax savings, or debt and get a structured response from the specialist agents.
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
                <span className={`size-2 rounded-full ${streaming ? "animate-pulse bg-emerald-400" : "bg-primary"}`} />
                {streaming ? "Agents analyzing live" : "Ready for a new question"}
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex min-h-[calc(100vh-14rem)] flex-col p-4 sm:p-6">
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {messages.map((message, index) => (
                <ChatMessageBubble
                  key={`${message.role}-${index}`}
                  message={{
                    role: message.role,
                    content: message.content,
                    agents: message.agents,
                  }}
                />
              ))}

              {streaming && thinkingText && (
                <ChatThinkingCard text={thinkingText} activeAgents={activeAgents} />
              )}

              <div ref={scrollRef} />
            </div>

            <div className="mt-5 rounded-[28px] border border-border/60 bg-background/35 p-3 shadow-[0_18px_45px_-35px_rgba(0,0,0,0.5)]">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about spending, goals, investments, tax savings..."
                className="min-h-24 resize-none border-0 bg-transparent px-1 shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0"
                disabled={streaming}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs leading-6 text-muted-foreground">
                  Tip: ask one focused question for the cleanest recommendation.
                </p>
                <Button onClick={() => submitPrompt(input)} disabled={streaming || !input.trim()} className="min-w-36">
                  {streaming ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Thinking
                    </>
                  ) : (
                    <>
                      Ask Copilot
                      <SendHorizontal className="ml-2 size-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <AgentStatusCard agents={agentInfo} activeAgents={activeAgents} />

          <Card data-animate="card" className="border-border/60 bg-card/80 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.65)] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="size-5 text-primary" />
                Suggested prompts
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Start with a specific question to get a sharper answer from the agents.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => submitPrompt(prompt)}
                  disabled={streaming}
                  className="w-full rounded-2xl border border-border/60 bg-background/35 px-4 py-3 text-left text-sm leading-7 text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
