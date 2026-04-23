"use client";

import { useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Bot, Brain, Goal, LayoutDashboard, LogOut, Menu, ReceiptText, Sparkles } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SupportWidget } from "@/components/support-widget";
import { cn } from "@/lib/utils";
import { clearSession, getStoredUser } from "@/lib/auth";

gsap.registerPlugin(useGSAP);

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analysis", label: "My Money Story", icon: BarChart3 },
  { href: "/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/goals", label: "Goals", icon: Goal },
  { href: "/chat", label: "Ask Zova", icon: Bot },
  { href: "/guide", label: "How to Use", icon: BookOpen },
];

const subscribeToStoredUser = () => () => {};

function getStoredUserLabelSnapshot(): string | null {
  const user = getStoredUser();
  return user ? user.email.split("@")[0] : null;
}

function NavContent() {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const logo = navRef.current?.querySelector("[data-animate='nav-logo']");
      const links = navRef.current?.querySelectorAll("[data-animate='nav-link']");
      const footer = navRef.current?.querySelector("[data-animate='nav-footer']");

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

      if (logo) {
        tl.fromTo(logo, { autoAlpha: 0, x: -20 }, { autoAlpha: 1, x: 0, duration: 0.5 });
      }
      if (links && links.length > 0) {
        tl.fromTo(
          Array.from(links),
          { autoAlpha: 0, x: -16 },
          { autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.06 },
          "-=0.2",
        );
      }
      if (footer) {
        tl.fromTo(footer, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5 }, "-=0.1");
      }
    },
    { scope: navRef },
  );

  return (
    <div ref={navRef} className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto rounded-[28px] border border-border/70 bg-sidebar/80 p-5 surface-glow backdrop-blur-xl">
      <div data-animate="nav-logo">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <Brain className="size-4" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-primary">Finzova</p>
            <h1 className="text-lg font-semibold tracking-tight leading-none">Your money sidekick</h1>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Personal money advice built on your real income, spends and goals.
        </p>
      </div>
      <nav className="flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              data-animate="nav-link"
              className={cn(
                "group relative flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-sm transition-all",
                active
                  ? "border-primary/40 bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_rgba(16,185,129,0.08)]"
                  : "border-transparent bg-background/0 text-muted-foreground hover:border-border hover:bg-background/60 hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-3" data-animate="nav-footer">
        <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4 text-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <p className="font-medium text-primary">Rule-based pipeline</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Expense · Debt · Risk · Goal · Investment · Orchestrator — deterministic scoring on your snapshot.
          </p>
        </div>
        <LogoutButton />
      </div>
    </div>
  );
}

function LogoutButton() {
  const userLabel = useSyncExternalStore(
    subscribeToStoredUser,
    getStoredUserLabelSnapshot,
    () => null,
  );

  function handleLogout() {
    clearSession();
    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-background/30 px-4 py-3 text-sm text-muted-foreground transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
    >
      <LogOut className="size-4" />
      {userLabel ? `Sign out (${userLabel})` : "Sign out"}
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const mainRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!mainRef.current) return;
      gsap.fromTo(
        mainRef.current,
        { autoAlpha: 0, y: 20 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "power3.out" },
      );
    },
    { scope: mainRef },
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px] items-start gap-6 px-4 py-4 sm:px-6 lg:px-8">
      <aside className="hidden w-[320px] shrink-0 lg:sticky lg:top-4 lg:block lg:h-[calc(100vh-2rem)]">
        <NavContent />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
              <Brain className="size-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-primary">Finzova</p>
              <h1 className="text-lg font-semibold leading-none">Your money sidekick</h1>
            </div>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="border-border/70 bg-background/95 p-4">
              <NavContent />
            </SheetContent>
          </Sheet>
        </div>
        <main ref={mainRef} className="min-w-0 flex-1">{children}</main>
      </div>
      <SupportWidget />
    </div>
  );
}
