// A whole number that runs to its new value instead of jumping there, for an estimate that has
// just changed. Without animation (reduced motion) it is the value itself, at once.

import { useEffect, useRef, useState } from "react";

export const COUNT_UP_MS = 400;

export function useCountUp(target: number, animate: boolean, duration: number = COUNT_UP_MS): number {
  const [shown, setShown] = useState(target);
  const latest = useRef(target); // the number on screen, also in the middle of a run

  useEffect(() => {
    if (!animate || latest.current === target) {
      latest.current = target;
      setShown(target);
      return;
    }
    const origin = latest.current;
    const startedAt = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      latest.current = Math.round(origin + (target - origin) * eased);
      setShown(latest.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, animate, duration]);

  return animate ? shown : target;
}
