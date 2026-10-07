import { describe, expect, it } from "vitest";
import { FEATURES } from "../test/fixtures";
import {
  formatBound,
  formatMeasurement,
  formatNumber,
  formatPercent,
  formatRelative,
  ordinal,
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
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(1)).toBe("100%");
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

  it("writes ordinals", () => {
    expect([0, 1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 81, 100, 101, 111].map(ordinal)).toEqual([
      "0th", "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "81st",
      "100th", "101st", "111th",
    ]);
  });
});
