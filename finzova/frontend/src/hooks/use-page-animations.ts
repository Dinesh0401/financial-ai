"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

/**
 * Animates all direct children of a container with staggered fade-slide-in.
 * Attach the returned ref to the outermost wrapper of the page content.
 */
export function usePageEntrance() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const children = containerRef.current?.children;
      if (!children || children.length === 0) return;

      gsap.set(Array.from(children), { autoAlpha: 0, y: 32 });

      gsap.to(Array.from(children), {
        autoAlpha: 1,
        y: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: "power3.out",
      });
    },
    { scope: containerRef },
  );

  return containerRef;
}

/**
 * Animates cards within a grid — each card scales up and fades in.
 * Attach the returned ref to the grid container.
 */
export function useCardReveal() {
  const gridRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const cards = gridRef.current?.querySelectorAll("[data-animate='card']");
      if (!cards || cards.length === 0) return;

      gsap.set(Array.from(cards), { autoAlpha: 0, y: 24, scale: 0.97 });

      gsap.to(Array.from(cards), {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        stagger: 0.08,
        ease: "back.out(1.4)",
        delay: 0.15,
      });
    },
    { scope: gridRef },
  );

  return gridRef;
}

/**
 * Staggered list item entrance — items slide in from the left.
 */
export function useListStagger() {
  const listRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const items = listRef.current?.querySelectorAll("[data-animate='item']");
      if (!items || items.length === 0) return;

      gsap.set(Array.from(items), { autoAlpha: 0, x: -20 });

      gsap.to(Array.from(items), {
        autoAlpha: 1,
        x: 0,
        duration: 0.5,
        stagger: 0.06,
        ease: "power2.out",
        delay: 0.3,
      });
    },
    { scope: listRef },
  );

  return listRef;
}

/**
 * Hero section entrance — heading scales up, description fades in.
 */
export function useHeroEntrance() {
  const heroRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const heading = heroRef.current?.querySelector("[data-animate='hero-heading']");
      const desc = heroRef.current?.querySelector("[data-animate='hero-desc']");
      const badges = heroRef.current?.querySelectorAll("[data-animate='hero-badge']");
      const gauge = heroRef.current?.querySelector("[data-animate='hero-gauge']");

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      if (heading) {
        tl.fromTo(heading, { autoAlpha: 0, y: 40, scale: 0.96 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.8 });
      }
      if (desc) {
        tl.fromTo(desc, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6 }, "-=0.5");
      }
      if (badges && badges.length > 0) {
        tl.fromTo(
          Array.from(badges),
          { autoAlpha: 0, scale: 0.8, y: 10 },
          { autoAlpha: 1, scale: 1, y: 0, duration: 0.4, stagger: 0.06 },
          "-=0.3",
        );
      }
      if (gauge) {
        tl.fromTo(gauge, { autoAlpha: 0, scale: 0.85, rotation: -10 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.8, ease: "back.out(1.6)" }, "-=0.4");
      }
    },
    { scope: heroRef },
  );

  return heroRef;
}

/**
 * Sidebar / nav entrance animation.
 */
export function useNavEntrance() {
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
          { autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.05 },
          "-=0.2",
        );
      }
      if (footer) {
        tl.fromTo(footer, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5 }, "-=0.1");
      }
    },
    { scope: navRef },
  );

  return navRef;
}

/**
 * Step transition for onboarding — new step content slides in.
 */
export function useStepTransition(step: number) {
  const stepRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!stepRef.current) return;

      const fields = stepRef.current.querySelectorAll("[data-animate='field']");

      gsap.fromTo(
        stepRef.current,
        { autoAlpha: 0, x: 60 },
        { autoAlpha: 1, x: 0, duration: 0.5, ease: "power3.out" },
      );

      if (fields.length > 0) {
        gsap.fromTo(
          Array.from(fields),
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.06, ease: "power2.out", delay: 0.15 },
        );
      }
    },
    { scope: stepRef, dependencies: [step], revertOnUpdate: true },
  );

  return stepRef;
}
