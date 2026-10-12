"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up to `target` (and from one target to the next) so big numbers feel alive.
 * Jumps straight there when the visitor prefers reduced motion.
 */
export function useCountUp(target: number, duration = 650): number {
  const [value, setValue] = useState(0);
  const shown = useRef(0);

  useEffect(() => {
    if (duration <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      shown.current = target;
      setValue(target);
      return;
    }
    const from = shown.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      shown.current = Math.round(from + (target - from) * eased);
      setValue(shown.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
