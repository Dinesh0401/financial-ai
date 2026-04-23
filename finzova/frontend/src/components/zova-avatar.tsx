"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export type ZovaMood = "idle" | "happy" | "concerned" | "thinking";

type Props = {
  size?: number;
  mood?: ZovaMood;
  thinking?: boolean;
  className?: string;
  glow?: boolean;
};

const MOUTH_PATH: Record<ZovaMood, string> = {
  idle: "M 17 30 Q 24 36 31 30",
  happy: "M 15 29 Q 24 40 33 29",
  concerned: "M 17 33 Q 24 29 31 33",
  thinking: "M 18 32 Q 24 32 30 32",
};

const BODY_GRAD: Record<ZovaMood, { from: string; mid: string; to: string }> = {
  idle: { from: "#6ee7b7", mid: "#10b981", to: "#065f46" },
  happy: { from: "#bbf7d0", mid: "#22c55e", to: "#047857" },
  concerned: { from: "#fde68a", mid: "#f59e0b", to: "#92400e" },
  thinking: { from: "#a7f3d0", mid: "#10b981", to: "#065f46" },
};

export function ZovaAvatar({
  size = 40,
  mood,
  thinking = false,
  className,
  glow = true,
}: Props) {
  const activeMood: ZovaMood = mood ?? (thinking ? "thinking" : "idle");

  const wrapRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const eyeLeftRef = useRef<SVGCircleElement>(null);
  const eyeRightRef = useRef<SVGCircleElement>(null);
  const browLeftRef = useRef<SVGPathElement>(null);
  const browRightRef = useRef<SVGPathElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const sparkleRef = useRef<SVGGElement>(null);
  const sparkleSideRef = useRef<SVGGElement>(null);
  const cheekLeftRef = useRef<SVGCircleElement>(null);
  const cheekRightRef = useRef<SVGCircleElement>(null);
  const bodyFromRef = useRef<SVGStopElement>(null);
  const bodyMidRef = useRef<SVGStopElement>(null);
  const bodyToRef = useRef<SVGStopElement>(null);

  useEffect(() => {
    const tweens: gsap.core.Tween[] = [];
    const tls: gsap.core.Timeline[] = [];

    if (bodyRef.current) {
      tweens.push(
        gsap.to(bodyRef.current, {
          scale: 1.05,
          transformOrigin: "50% 50%",
          duration: 2.4,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        }),
      );
      tweens.push(
        gsap.to(bodyRef.current, {
          y: -1.5,
          duration: 3,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        }),
      );
    }

    if (eyeLeftRef.current && eyeRightRef.current) {
      const blink = gsap.timeline({ repeat: -1, repeatDelay: 3.5 });
      blink.to([eyeLeftRef.current, eyeRightRef.current], {
        scaleY: 0.1,
        transformOrigin: "50% 50%",
        duration: 0.08,
        ease: "power2.in",
      });
      blink.to([eyeLeftRef.current, eyeRightRef.current], {
        scaleY: 1,
        duration: 0.12,
        ease: "power2.out",
      });
      tls.push(blink);
    }

    if (ringRef.current) {
      tweens.push(
        gsap.to(ringRef.current, {
          rotation: 360,
          transformOrigin: "50% 50%",
          duration: 12,
          ease: "none",
          repeat: -1,
        }),
      );
    }

    if (sparkleRef.current) {
      tweens.push(
        gsap.fromTo(
          sparkleRef.current,
          { opacity: 0.4, scale: 0.9, transformOrigin: "50% 50%" },
          {
            opacity: 1,
            scale: 1.1,
            duration: 1.6,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          },
        ),
      );
    }

    return () => {
      tweens.forEach((t) => t.kill());
      tls.forEach((t) => t.kill());
    };
  }, []);

  useEffect(() => {
    const eyes = [eyeLeftRef.current, eyeRightRef.current].filter(Boolean) as SVGCircleElement[];
    const mouth = mouthRef.current;
    const brows = [browLeftRef.current, browRightRef.current].filter(Boolean) as SVGPathElement[];
    const cheeks = [cheekLeftRef.current, cheekRightRef.current].filter(Boolean) as SVGCircleElement[];
    const body = bodyRef.current;

    gsap.killTweensOf(eyes);
    gsap.killTweensOf(brows);
    gsap.killTweensOf(cheeks);

    if (mouth) {
      gsap.to(mouth, { attr: { d: MOUTH_PATH[activeMood] }, duration: 0.4, ease: "power2.out" });
    }

    const grad = BODY_GRAD[activeMood];
    if (bodyFromRef.current) gsap.to(bodyFromRef.current, { attr: { "stop-color": grad.from }, duration: 0.5 });
    if (bodyMidRef.current) gsap.to(bodyMidRef.current, { attr: { "stop-color": grad.mid }, duration: 0.5 });
    if (bodyToRef.current) gsap.to(bodyToRef.current, { attr: { "stop-color": grad.to }, duration: 0.5 });

    if (activeMood === "thinking") {
      gsap.to(eyes, { x: 1.8, y: -0.6, duration: 0.7, yoyo: true, repeat: -1, ease: "sine.inOut" });
      gsap.to(brows, { y: -1.5, duration: 0.3, ease: "power2.out" });
      gsap.to(cheeks, { opacity: 0.35, duration: 0.3 });
    } else if (activeMood === "happy") {
      gsap.to(eyes, { x: 0, y: 0, scaleY: 0.55, transformOrigin: "50% 50%", duration: 0.3, ease: "back.out(2)" });
      gsap.to(brows, { y: -2, duration: 0.3, ease: "power2.out" });
      gsap.to(cheeks, { opacity: 0.85, duration: 0.3 });
      if (body) {
        gsap.fromTo(
          body,
          { rotation: -4, transformOrigin: "50% 50%" },
          { rotation: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" },
        );
      }
    } else if (activeMood === "concerned") {
      gsap.to(eyes, { x: 0, y: 0, scaleY: 1.1, transformOrigin: "50% 50%", duration: 0.3 });
      gsap.to(brows, { y: 1.5, duration: 0.3, ease: "power2.out" });
      gsap.to(cheeks, { opacity: 0.25, duration: 0.3 });
      if (body) {
        gsap.fromTo(
          body,
          { x: -1.2 },
          { x: 1.2, duration: 0.12, yoyo: true, repeat: 3, ease: "sine.inOut", onComplete: () => { gsap.set(body, { x: 0 }); } },
        );
      }
    } else {
      gsap.to(eyes, { x: 0, y: 0, scaleY: 1, duration: 0.3, ease: "power2.out" });
      gsap.to(brows, { y: 0, duration: 0.3 });
      gsap.to(cheeks, { opacity: 0.55, duration: 0.3 });
    }
  }, [activeMood]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        width: size,
        height: size,
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {glow && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: "9999px",
            background:
              activeMood === "concerned"
                ? "radial-gradient(circle at 50% 50%, rgba(245,158,11,0.35) 0%, rgba(245,158,11,0) 65%)"
                : activeMood === "happy"
                  ? "radial-gradient(circle at 50% 50%, rgba(34,197,94,0.5) 0%, rgba(34,197,94,0) 65%)"
                  : "radial-gradient(circle at 50% 50%, rgba(52,211,153,0.35) 0%, rgba(52,211,153,0) 65%)",
            filter: "blur(6px)",
            transition: "background 0.4s ease",
          }}
        />
      )}
      <svg viewBox="0 0 48 48" width={size} height={size} style={{ display: "block", position: "relative" }}>
        <defs>
          <radialGradient id="zova-body" cx="35%" cy="30%" r="75%">
            <stop ref={bodyFromRef} offset="0%" stopColor={BODY_GRAD.idle.from} />
            <stop ref={bodyMidRef} offset="60%" stopColor={BODY_GRAD.idle.mid} />
            <stop ref={bodyToRef} offset="100%" stopColor={BODY_GRAD.idle.to} />
          </radialGradient>
          <linearGradient id="zova-ring" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#34d399" stopOpacity="0" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        <circle
          ref={ringRef}
          cx="24"
          cy="24"
          r="22"
          fill="none"
          stroke="url(#zova-ring)"
          strokeWidth="1.2"
          strokeDasharray="3 4"
        />

        <g ref={bodyRef}>
          <circle cx="24" cy="24" r="20" fill="url(#zova-body)" />
          <circle cx="18" cy="18" r="6" fill="#ffffff" opacity="0.18" />

          <path
            ref={browLeftRef}
            d="M 14 16 Q 17 15 20 16"
            stroke="#ffffff"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />
          <path
            ref={browRightRef}
            d="M 28 16 Q 31 15 34 16"
            stroke="#ffffff"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
            opacity="0.8"
          />

          <circle ref={eyeLeftRef} cx="17" cy="21" r="2.6" fill="#ffffff" />
          <circle ref={eyeRightRef} cx="31" cy="21" r="2.6" fill="#ffffff" />
          <circle cx="17.8" cy="20.4" r="0.9" fill="#0f172a" />
          <circle cx="31.8" cy="20.4" r="0.9" fill="#0f172a" />

          <circle ref={cheekLeftRef} cx="12" cy="28" r="2.2" fill="#fca5a5" opacity="0.55" />
          <circle ref={cheekRightRef} cx="36" cy="28" r="2.2" fill="#fca5a5" opacity="0.55" />

          <path
            ref={mouthRef}
            d={MOUTH_PATH.idle}
            stroke="#ffffff"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        </g>

        <g ref={sparkleRef} transform="translate(38 10)">
          <path d="M 0 -3 L 0.8 -0.8 L 3 0 L 0.8 0.8 L 0 3 L -0.8 0.8 L -3 0 L -0.8 -0.8 Z" fill="#fef08a" />
        </g>

        {activeMood === "happy" && (
          <g ref={sparkleSideRef}>
            <path
              d="M 9 12 L 9.5 13 L 10.5 13.5 L 9.5 14 L 9 15 L 8.5 14 L 7.5 13.5 L 8.5 13 Z"
              fill="#fef08a"
              opacity="0.9"
            >
              <animateTransform
                attributeName="transform"
                type="scale"
                values="0.6;1.2;0.6"
                dur="1.2s"
                repeatCount="indefinite"
                additive="sum"
              />
            </path>
            <path
              d="M 40 30 L 40.5 31 L 41.5 31.5 L 40.5 32 L 40 33 L 39.5 32 L 38.5 31.5 L 39.5 31 Z"
              fill="#fef08a"
              opacity="0.9"
            >
              <animateTransform
                attributeName="transform"
                type="scale"
                values="0.6;1.2;0.6"
                dur="1.4s"
                begin="0.2s"
                repeatCount="indefinite"
                additive="sum"
              />
            </path>
          </g>
        )}

        {activeMood === "concerned" && (
          <g>
            <path
              d="M 33 12 L 34 14 L 36 14 L 34.5 15.2 L 35 17.5 L 33 16.2 L 31 17.5 L 31.5 15.2 L 30 14 L 32 14 Z"
              fill="none"
              stroke="#fca5a5"
              strokeWidth="0.8"
              opacity="0.8"
              transform="translate(-1 -2)"
            >
              <animate
                attributeName="opacity"
                values="0.3;0.9;0.3"
                dur="1.2s"
                repeatCount="indefinite"
              />
            </path>
          </g>
        )}
      </svg>
    </div>
  );
}
