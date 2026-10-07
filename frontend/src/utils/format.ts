// Display formatting (BR-14). Mirrors the backend's wording where both sides print the same thing.

import type { FeatureSchema, FeatureValue } from "../api/types";

function decimalsOf(step: number): number {
  return (String(step).split(".")[1] ?? "").length;
}

function trimZeros(text: string): string {
  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
}

/** A number at the precision of the feature's step, without trailing zeros. */
export function formatNumber(value: number, step: number): string {
  return trimZeros(value.toFixed(decimalsOf(step)));
}

/**
 * A range limit at display precision, rounded into the range: every value between the two
 * printed limits is accepted. Same rule as the backend's range message.
 */
export function formatBound(value: number, step: number, limit: "min" | "max"): string {
  const decimals = decimalsOf(step);
  const scaled = value * 10 ** decimals;
  const inward = limit === "min" ? Math.ceil(scaled - 1e-9) : Math.floor(scaled + 1e-9);
  return trimZeros((inward / 10 ** decimals).toFixed(decimals));
}

/** A measurement with its unit: "Yes", "67 years", "55%", "LBBB". */
export function formatMeasurement(feature: FeatureSchema, value: FeatureValue): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  const text = formatNumber(value, feature.step ?? 1);
  if (!feature.unit) return text;
  return feature.unit === "%" ? `${text}%` : `${text} ${feature.unit}`;
}

/** Probability as an integer percentage: 0.5810 -> "58%". */
export function formatPercent(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

/** Signed relative contribution as an integer percentage, "<1%" when it rounds to nothing. */
export function formatRelative(relative: number): string {
  const size = Math.abs(relative);
  if (size === 0) return "0%";
  if (size < 0.005) return "<1%";
  return `${relative > 0 ? "+" : "−"}${Math.round(size * 100)}%`;
}

/** 1 -> "1st", 22 -> "22nd", 81 -> "81st", 12 -> "12th". */
export function ordinal(value: number): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  return `${value}${["th", "st", "nd", "rd"][value % 10] ?? "th"}`;
}
