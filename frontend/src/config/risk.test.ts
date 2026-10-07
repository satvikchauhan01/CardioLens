import { describe, expect, it } from "vitest";
import { NO_ESTIMATE_COLOR, relativeLuminance, RISK_GRADIENT, RISK_STOPS, riskColor } from "./risk";

const HEX = /^#[0-9a-f]{6}$/;

describe("risk colour scale (BR-5)", () => {
  it("is teal at 0, amber at 0.5 and crimson at 1", () => {
    expect(riskColor(0)).toBe("#14b8a6");
    expect(riskColor(0.5)).toBe("#b45309");
    expect(riskColor(1)).toBe("#881337");
    expect([riskColor(0), riskColor(0.5), riskColor(1)]).toEqual([...RISK_STOPS]);
  });

  it("gives a valid colour for every probability and has no jump, also at the amber stop", () => {
    const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const jump = (a: string, b: string) => Math.max(...channels(a).map((value, i) => Math.abs(value - channels(b)[i])));

    for (let step = 1; step <= 100; step += 1) {
      expect(riskColor(step / 100)).toMatch(HEX);
      // The steps are even to the eye (OKLab), not in sRGB numbers, hence the generous limit.
      expect(jump(riskColor(step / 100), riskColor((step - 1) / 100))).toBeLessThanOrEqual(24);
    }
    expect(jump(riskColor(0.499), riskColor(0.5))).toBeLessThanOrEqual(3);
    expect(jump(riskColor(0.5), riskColor(0.501))).toBeLessThanOrEqual(3);
    expect(jump(riskColor(0.001), riskColor(0))).toBeLessThanOrEqual(3);
    expect(jump(riskColor(0.999), riskColor(1))).toBeLessThanOrEqual(3);
  });

  it("gets darker as the probability rises, so it reads without telling red from green", () => {
    const luminance = Array.from({ length: 101 }, (_, step) => relativeLuminance(riskColor(step / 100)));
    for (let step = 1; step <= 100; step += 1) {
      expect(luminance[step]).toBeLessThan(luminance[step - 1]);
    }
    expect(luminance[0]).toBeGreaterThan(0.35);
    expect(luminance[100]).toBeLessThan(0.08);
  });

  it("clamps probabilities outside 0 to 1", () => {
    expect(riskColor(-0.2)).toBe(riskColor(0));
    expect(riskColor(1.7)).toBe(riskColor(1));
  });

  it("uses a neutral grey when there is no estimate", () => {
    expect(riskColor(null)).toBe(NO_ESTIMATE_COLOR);
    expect(riskColor(undefined)).toBe(NO_ESTIMATE_COLOR);
    expect(riskColor(Number.NaN)).toBe(NO_ESTIMATE_COLOR);
    for (let step = 0; step <= 20; step += 1) {
      expect(riskColor(step / 20)).not.toBe(NO_ESTIMATE_COLOR);
    }
  });

  it("offers the same scale as a CSS gradient for the legend", () => {
    const colors = RISK_GRADIENT.match(/#[0-9a-f]{6}/g) ?? [];
    expect(RISK_GRADIENT.startsWith("linear-gradient(to right, ")).toBe(true);
    expect(colors).toEqual(Array.from({ length: 11 }, (_, step) => riskColor(step / 10)));
  });

  it("computes relative luminance", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 6);
  });
});
