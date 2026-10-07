import { describe, expect, it } from "vitest";
import { FEATURES } from "../test/fixtures";
import {
  deltaPoints,
  formatBound,
  formatDelta,
  formatMeasurement,
  formatNumber,
  formatPercent,
  formatRelative,
  formatStat,
  ordinal,
  percentPoints,
} from "./format";

const feature = (id: string) => FEATURES.find((item) => item.id === id)!;

describe("formatting (BR-14)", () => {
  it("prints numbers at the step's precision without trailing zeros", () => {
    expect(formatNumber(67, 1)).toBe("67");
    expect(formatNumber(29.387755, 0.1)).toBe("29.4");
    expect(formatNumber(30, 0.1)).toBe("30");
    expect(formatNumber(1.15, 0.05)).toBe("1.15");
    expect(formatNumber(0.7, 0.05)).toBe("0.7");
    expect(formatNumber(100, 1)).toBe("100");
  });

  it("rounds range limits into the range", () => {
    expect(formatBound(18.115412710007302, 0.1, "min")).toBe("18.2");
    expect(formatBound(40.90065778377467, 0.1, "max")).toBe("40.9");
    expect(formatBound(0.5, 0.05, "min")).toBe("0.5");
    expect(formatBound(0.7, 0.05, "min")).toBe("0.7");
    expect(formatBound(2.2, 0.05, "max")).toBe("2.2");
    expect(formatBound(30, 1, "min")).toBe("30");
    expect(formatBound(86, 1, "max")).toBe("86");
  });

  it("prints measurements with their unit", () => {
    expect(formatMeasurement(feature("age"), 67)).toBe("67 years");
    expect(formatMeasurement(feature("ef_tte"), 55)).toBe("55%");
    expect(formatMeasurement(feature("bmi"), 29.387755102040817)).toBe("29.4 kg/m²");
    expect(formatMeasurement(feature("cr"), 1.15)).toBe("1.15 mg/dL");
    expect(formatMeasurement(feature("dm"), true)).toBe("Yes");
    expect(formatMeasurement(feature("dm"), false)).toBe("No");
    expect(formatMeasurement(feature("bbb"), "LBBB")).toBe("LBBB");
    expect(formatMeasurement({ ...feature("age"), unit: null }, 2)).toBe("2");
  });

  it("prints probabilities as integer percentages", () => {
    expect(formatPercent(0.581)).toBe("58%");
    expect(formatPercent(0.4949)).toBe("49%");
    expect(formatPercent(0.5)).toBe("50%");
    expect(formatPercent(0.994)).toBe("99%");
    expect(formatPercent(0.005)).toBe("1%");
  });

  it("never prints a bare 100% or 0%", () => {
    expect(formatPercent(0.9975)).toBe(">99%");
    expect(formatPercent(0.995)).toBe(">99%");
    expect(formatPercent(1)).toBe(">99%");
    expect(formatPercent(0.0049)).toBe("<1%");
    expect(formatPercent(0)).toBe("<1%");
  });

  it("rounds to whole percentage points within 0 to 100", () => {
    expect([0.581, 0.9975, 0, 1.4, -0.2].map(percentPoints)).toEqual([58, 100, 0, 100, 0]);
  });

  it("prints a what-if change as before → after with signed percentage points (BR-10)", () => {
    expect(formatDelta(0.584, 0.436)).toBe("58% → 44%, −14 pp");
    expect(formatDelta(0.3, 0.42)).toBe("30% → 42%, +12 pp");
    expect(formatDelta(0.5, 0.5)).toBe("50% → 50%, 0 pp");
    expect(formatDelta(0.9975, 0.97)).toBe(">99% → 97%, −3 pp");
    expect(formatDelta(0.002, 0.03)).toBe("<1% → 3%, +3 pp");
    // The points are the difference of the two numbers on screen, not of the hidden decimals.
    expect(deltaPoints(0.574, 0.566)).toBe(0);
    expect(deltaPoints(0.5749, 0.5651)).toBe(0);
    expect(deltaPoints(0.584, 0.436)).toBe(-14);
  });

  it("prints relative contributions signed, and <1% when they round to nothing", () => {
    expect(formatRelative(0.24)).toBe("+24%");
    expect(formatRelative(-0.06)).toBe("−6%");
    expect(formatRelative(0.005)).toBe("+1%");
    expect(formatRelative(0.0049)).toBe("<1%");
    expect(formatRelative(-0.0001)).toBe("<1%");
    expect(formatRelative(0)).toBe("0%");
    expect(formatRelative(1)).toBe("+100%");
  });

  it("prints a cross-validated metric as mean ± std with three decimals", () => {
    expect(formatStat({ mean: 0.9166, std: 0.0334 })).toBe("0.917 ± 0.033");
    expect(formatStat({ mean: 0.5, std: 0 })).toBe("0.500 ± 0.000");
    expect(formatStat({ mean: 0.7249, std: 0.045 })).toBe("0.725 ± 0.045");
  });

  it("writes ordinals", () => {
    expect([0, 1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 81, 100, 101, 111].map(ordinal)).toEqual([
      "0th", "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "81st",
      "100th", "101st", "111th",
    ]);
  });
});
