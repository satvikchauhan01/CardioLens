import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COUNT_UP_MS, useCountUp } from "./useCountUp";

const FRAME_MS = 16;

function mount(animate: boolean, first = 55) {
  return renderHook(({ value }) => useCountUp(value, animate), { initialProps: { value: first } });
}

/** Lets the animation run for a while and returns every number that was shown. */
function watch(hook: ReturnType<typeof mount>, milliseconds: number): number[] {
  const seen: number[] = [];
  for (let elapsed = 0; elapsed < milliseconds; elapsed += FRAME_MS) {
    act(() => {
      vi.advanceTimersByTime(FRAME_MS);
    });
    seen.push(hook.result.current);
  }
  return seen;
}

describe("useCountUp", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is the value itself, at once, without animation", () => {
    const hook = mount(false);
    expect(hook.result.current).toBe(55);

    hook.rerender({ value: 47 });
    expect(hook.result.current).toBe(47);
  });

  it("starts at the value and does not move while it stays the same", () => {
    const hook = mount(true);

    expect(hook.result.current).toBe(55);
    expect(new Set(watch(hook, COUNT_UP_MS))).toEqual(new Set([55]));
  });

  it("runs from the number on screen to the new one, through the numbers between", () => {
    const hook = mount(true);
    hook.rerender({ value: 47 });

    const seen = watch(hook, COUNT_UP_MS + 3 * FRAME_MS);

    expect(seen.at(-1)).toBe(47);
    expect(seen.every((value) => value >= 47 && value <= 55)).toBe(true);
    expect(seen.some((value) => value > 47 && value < 55)).toBe(true);
    // It only ever moves towards the new value.
    expect([...seen].sort((a, b) => b - a)).toEqual(seen);
  });

  it("turns round from where it is when the value changes again", () => {
    const hook = mount(true, 20);
    hook.rerender({ value: 80 });
    const before = watch(hook, COUNT_UP_MS / 4).at(-1)!;
    expect(before).toBeGreaterThan(20);
    expect(before).toBeLessThan(80);

    hook.rerender({ value: 10 });
    const seen = watch(hook, COUNT_UP_MS + 3 * FRAME_MS);

    expect(Math.max(...seen)).toBeLessThanOrEqual(before);
    expect(seen.at(-1)).toBe(10);
  });

  it("stops when it is no longer shown", () => {
    const hook = mount(true);
    hook.rerender({ value: 90 });
    watch(hook, FRAME_MS * 2);

    hook.unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
