"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

type Props = {
  size?: number;
  thinking?: boolean;
  className?: string;
  glow?: boolean;
};

export function ZoyaAvatar({ size = 40, thinking = false, className, glow = true }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const eyeLeftRef = useRef<SVGCircleElement>(null);
  const eyeRightRef = useRef<SVGCircleElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const sparkleRef = useRef<SVGGElement>(null);

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
    if (thinking) {
      gsap.killTweensOf(eyes);
      gsap.to(eyes, {
        x: 1.8,
        y: -0.6,
        duration: 0.7,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
      if (mouth) {
        gsap.to(mouth, {
          attr: { d: "M 18 32 Q 24 32 30 32" },
          duration: 0.4,
          ease: "power2.out",
        });
      }
    } else {
      gsap.killTweensOf(eyes);
      gsap.to(eyes, { x: 0, y: 0, duration: 0.3, ease: "power2.out" });
      if (mouth) {
        gsap.to(mouth, {
          attr: { d: "M 17 30 Q 24 36 31 30" },
          duration: 0.4,
          ease: "power2.out",
        });
      }
    }
  }, [thinking]);

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
              "radial-gradient(circle at 50% 50%, rgba(52,211,153,0.35) 0%, rgba(52,211,153,0) 65%)",
            filter: "blur(6px)",
          }}
        />
      )}
      <svg viewBox="0 0 48 48" width={size} height={size} style={{ display: "block", position: "relative" }}>
        <defs>
          <radialGradient id="zoya-body" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#6ee7b7" />
            <stop offset="60%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#065f46" />
          </radialGradient>
          <linearGradient id="zoya-ring" x1="0%" y1="0%" x2="100%" y2="100%">
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
          stroke="url(#zoya-ring)"
          strokeWidth="1.2"
          strokeDasharray="3 4"
        />

        <g ref={bodyRef}>
          <circle cx="24" cy="24" r="20" fill="url(#zoya-body)" />
          <circle cx="18" cy="18" r="6" fill="#ffffff" opacity="0.18" />

          <circle ref={eyeLeftRef} cx="17" cy="21" r="2.6" fill="#ffffff" />
          <circle ref={eyeRightRef} cx="31" cy="21" r="2.6" fill="#ffffff" />
          <circle cx="17.8" cy="20.4" r="0.9" fill="#0f172a" />
          <circle cx="31.8" cy="20.4" r="0.9" fill="#0f172a" />

          <circle cx="12" cy="28" r="2.2" fill="#fca5a5" opacity="0.55" />
          <circle cx="36" cy="28" r="2.2" fill="#fca5a5" opacity="0.55" />

          <path
            ref={mouthRef}
            d="M 17 30 Q 24 36 31 30"
            stroke="#ffffff"
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        </g>

        <g ref={sparkleRef} transform="translate(38 10)">
          <path d="M 0 -3 L 0.8 -0.8 L 3 0 L 0.8 0.8 L 0 3 L -0.8 0.8 L -3 0 L -0.8 -0.8 Z" fill="#fef08a" />
        </g>
      </svg>
    </div>
  );
}
