"use client";

import { useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Bot,
  Goal,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SupportWidget } from "@/components/support-widget";
import { ZovaAvatar } from "@/components/zova-avatar";
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

function NavLinks({
  pathname,
  layout,
  onNavigate,
}: {
  pathname: string;
  layout: "horizontal" | "stack";
  onNavigate?: () => void;
}) {
  return (
    <nav
      className={cn(
        layout === "horizontal"
          ? "flex flex-1 items-center gap-1"
          : "flex flex-col gap-1",
      )}
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== "/" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            data-animate="nav-link"
            className={cn(
              "group relative flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm transition-all",
              layout === "stack" && "px-3.5 py-2.5",
              active
                ? "border-primary/40 bg-primary/15 text-foreground shadow-[inset_0_0_0_1px_rgba(16,185,129,0.08)]"
                : "border-transparent bg-background/0 text-muted-foreground hover:border-border hover:bg-background/60 hover:text-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0",
                active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            <span className="whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function LogoutButton({ compact = false }: { compact?: boolean }) {
  const userLabel = useSyncExternalStore(
    subscribeToStoredUser,
    getStoredUserLabelSnapshot,
    () => null,
  );

  function handleLogout() {
    clearSession();
    window.location.href = "/login";
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        title={userLabel ? `Sign out (${userLabel})` : "Sign out"}
        className="flex size-9 items-center justify-center rounded-full border border-border/50 bg-background/30 text-muted-foreground transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
      >
        <LogOut className="size-4" />
      </button>
    );
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

function MobileMenu({ pathname }: { pathname: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden">
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] border-border/70 bg-background/95 p-5">
        <div className="flex h-full flex-col gap-6">
          <div className="flex items-center gap-3">
            <ZovaAvatar size={42} mood="happy" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-primary">Finzova</p>
              <h2 className="text-base font-semibold leading-tight">Hi, I&apos;m Zova</h2>
              <p className="text-xs text-muted-foreground">your money buddy</p>
            </div>
          </div>
          <NavLinks pathname={pathname} layout="stack" />
          <div className="mt-auto space-y-3">
            <Link
              href="/chat"
              className="group block rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-primary/10 to-transparent p-4 transition hover:border-primary/40"
            >
              <div className="flex items-center gap-3">
                <ZovaAvatar size={32} mood="happy" glow={false} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Need help?</p>
                  <p className="text-xs leading-snug text-muted-foreground">
                    Ask me anything about your money &rarr;
                  </p>
                </div>
              </div>
            </Link>
            <LogoutButton />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TopBar() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!headerRef.current) return;
      const logo = headerRef.current.querySelector("[data-animate='nav-logo']");
      const links = headerRef.current.querySelectorAll("[data-animate='nav-link']");
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      if (logo) tl.fromTo(logo, { autoAlpha: 0, y: -12 }, { autoAlpha: 1, y: 0, duration: 0.45 });
      if (links.length > 0) {
        tl.fromTo(
          Array.from(links),
          { autoAlpha: 0, y: -10 },
          { autoAlpha: 1, y: 0, duration: 0.35, stagger: 0.05 },
          "-=0.2",
        );
      }
    },
    { scope: headerRef },
  );

  return (
    <header
      ref={headerRef}
      className="sticky top-3 z-30 mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8"
    >
      <div className="rounded-[28px] border border-border/70 bg-background/85 px-4 py-3 shadow-[0_18px_45px_-30px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:px-5">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" data-animate="nav-logo" className="flex shrink-0 items-center gap-2">
            <ZovaAvatar size={38} mood="happy" />
            <div className="hidden min-w-0 sm:block">
              <p className="text-[9px] font-semibold uppercase tracking-[0.32em] text-primary">Finzova</p>
              <p className="text-sm font-semibold leading-tight text-foreground">Hi, I&apos;m Zova</p>
            </div>
          </Link>

          <div className="ml-2 hidden flex-1 lg:flex">
            <NavLinks pathname={pathname} layout="horizontal" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/chat"
              className="hidden items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20 sm:inline-flex"
            >
              <Bot className="size-3.5" />
              Ask Zova
            </Link>
            <div className="hidden lg:block">
              <LogoutButton compact />
            </div>
            <MobileMenu pathname={pathname} />
          </div>
        </div>
      </div>
    </header>
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
    <div className="min-h-screen w-full pt-3">
      <TopBar />
      <main
        ref={mainRef}
        className="mx-auto w-full max-w-[1600px] px-4 pb-12 pt-5 sm:px-6 lg:px-8"
      >
        {children}
      </main>
      <SupportWidget />
    </div>
  );
}
