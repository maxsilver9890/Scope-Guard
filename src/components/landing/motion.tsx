"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

const SCRAMBLE_CHARS = "!<>-_\\/[]{}=+*^?#$%&@abcdefghijklmnopqrstuvwxyz0123456789";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function useInViewOnce<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    if (
      typeof IntersectionObserver === "undefined" ||
      prefersReducedMotion()
    ) {
      const frame = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}

/* -------------------------------------------------------------------------- */
/* Split headline                                                             */
/* -------------------------------------------------------------------------- */

type SplitTextProps = {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  delay?: number;
  step?: number;
};

export function SplitText({
  text,
  as = "h2",
  className = "",
  delay = 0,
  step = 42,
}: SplitTextProps) {
  const { ref, inView } = useInViewOnce<HTMLElement>();
  const words = text.split(/\s+/).filter(Boolean);

  const content = words.map((word, index) => (
    <span
      key={`${word}-${index}`}
      aria-hidden="true"
      className="split-word"
      style={{ animationDelay: `${delay + index * step}ms` }}
    >
      {word}
      {index < words.length - 1 ? "\u00A0" : ""}
    </span>
  ));

  const props = {
    ref: ref as RefObject<never>,
    "aria-label": text,
    className: `split-text ${inView ? "is-visible" : ""} ${className}`.trim(),
  };

  if (as === "h1") {
    return <h1 {...props}>{content}</h1>;
  }
  if (as === "h3") {
    return <h3 {...props}>{content}</h3>;
  }
  if (as === "p") {
    return <p {...props}>{content}</p>;
  }
  return <h2 {...props}>{content}</h2>;
}

/* -------------------------------------------------------------------------- */
/* Scramble text                                                              */
/* -------------------------------------------------------------------------- */

type ScrambleTextProps = {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
};

export function ScrambleText({
  text,
  className = "",
  delay = 0,
  duration = 640,
}: ScrambleTextProps) {
  const { ref, inView } = useInViewOnce<HTMLSpanElement>();
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    if (!inView || prefersReducedMotion()) {
      return;
    }

    let frame = 0;
    let lastPaint = 0;
    const start = performance.now() + delay;

    const tick = (now: number) => {
      if (now < start) {
        frame = requestAnimationFrame(tick);
        return;
      }

      const progress = Math.min(1, (now - start) / duration);
      const revealed = Math.floor(progress * text.length);
      if (now - lastPaint >= 38 || progress >= 1) {
        lastPaint = now;
        setDisplay(
          text
            .split("")
            .map((character, index) => {
              if (index < revealed || !/[a-zA-Z0-9]/.test(character)) {
                return character;
              }
              return SCRAMBLE_CHARS[
                Math.floor(Math.random() * SCRAMBLE_CHARS.length)
              ];
            })
            .join(""),
        );
      }

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setDisplay(text);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [delay, duration, inView, text]);

  return (
    <span
      ref={ref}
      className={`scramble-text ${className}`.trim()}
      aria-label={text}
    >
      <span aria-hidden="true" className="scramble-sizer">
        {text}
      </span>
      <span aria-hidden="true" className="scramble-live">
        {display}
      </span>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Kinetic hero headline                                                      */
/* -------------------------------------------------------------------------- */

type KineticHeadlineProps = {
  before: string[];
  phrase: string;
  className?: string;
};

export function KineticHeadline({
  before,
  phrase,
  className = "",
}: KineticHeadlineProps) {
  const phraseWords = phrase.split(/\s+/).filter(Boolean);

  return (
    <h1
      aria-label={`${[...before, phrase].join(" ")}`}
      className={`kinetic-headline ${className}`.trim()}
    >
      {before.map((word, index) => (
        <span
          key={`${word}-${index}`}
          aria-hidden="true"
          className="kinetic-word"
          style={{ animationDelay: `${index * 72}ms` }}
        >
          {word}
          {"\u00A0"}
        </span>
      ))}
      <span aria-hidden="true" className="kinetic-phrase">
        {phraseWords.map((word, index) => (
          <span
            key={`${word}-${index}`}
            className="kinetic-word kinetic-word--emphasis"
            style={{ animationDelay: `${before.length * 72 + index * 94}ms` }}
          >
            <ScrambleText
              text={word}
              delay={300 + index * 90}
              duration={560}
            />
            {index < phraseWords.length - 1 ? "\u00A0" : ""}
          </span>
        ))}
      </span>
    </h1>
  );
}

/* -------------------------------------------------------------------------- */
/* Scroll progress + decorative drift                                         */
/* -------------------------------------------------------------------------- */

export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      const progress = max > 0 ? Math.min(1, root.scrollTop / max) : 0;
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${progress})`;
      }
      root.style.setProperty("--scroll-drift", `${root.scrollTop * -0.045}px`);
    };

    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div className="scroll-progress" aria-hidden="true">
      <div ref={barRef} className="scroll-progress-bar" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pointer aura                                                               */
/* -------------------------------------------------------------------------- */

export function HeroAura() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    const host = node?.parentElement;
    if (!node || !host) {
      return;
    }

    const finePointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
    if (!finePointer || prefersReducedMotion()) {
      return;
    }

    let frame = 0;
    let nextX = 50;
    let nextY = 40;

    const paint = () => {
      frame = 0;
      node.style.setProperty("--aura-x", `${nextX}%`);
      node.style.setProperty("--aura-y", `${nextY}%`);
      node.style.opacity = "1";
    };

    const onMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      nextX = ((event.clientX - rect.left) / rect.width) * 100;
      nextY = ((event.clientY - rect.top) / rect.height) * 100;
      if (!frame) {
        frame = requestAnimationFrame(paint);
      }
    };

    host.addEventListener("pointermove", onMove);
    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      host.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <div ref={ref} className="hero-aura" aria-hidden="true" />;
}

/* -------------------------------------------------------------------------- */
/* Perspective tilt wrapper                                                   */
/* -------------------------------------------------------------------------- */

export function TiltCard({
  children,
  className = "",
  strength = 5,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const finePointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)",
    ).matches;
    if (!finePointer || prefersReducedMotion()) {
      return;
    }

    let frame = 0;

    const apply = (rotateX: number, rotateY: number, lift: number) => {
      node.style.transform = `perspective(900px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translate3d(0, ${lift}px, 0)`;
    };

    const onMove = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      if (frame) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(() =>
        apply(py * -strength, px * strength, -2),
      );
    };

    const reset = () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      node.style.transform =
        "perspective(900px) rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0)";
    };

    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", reset);
    return () => {
      if (frame) {
        cancelAnimationFrame(frame);
      }
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", reset);
    };
  }, [strength]);

  return (
    <div ref={ref} className={`tilt-card ${className}`.trim()}>
      {children}
    </div>
  );
}
