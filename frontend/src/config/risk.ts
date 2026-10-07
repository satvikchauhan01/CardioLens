// BR-5: the one colour scale for model-estimated probability. Used by the 3D arteries, the 2D
// schematic, the legend and the result bars, so they can never disagree.
//
// Three stops, teal (p = 0) -> amber (p = 0.5) -> crimson (p = 1), interpolated in OKLab so that
// lightness falls steadily: a higher probability is always darker, which keeps the scale readable
// without telling red from green. Checked with the dataviz palette validator (ramp mode, five
// samples on white): lightness monotone, every step gap >= 0.06, light end 2.49:1.

export const RISK_STOPS = ["#14b8a6", "#b45309", "#881337"] as const;

/** Arteries before there is any estimate. */
export const NO_ESTIMATE_COLOR = "#94a3b8";

type Triple = [number, number, number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToLinearRgb(hex: string): Triple {
  return [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255)) as Triple;
}

function toOklab(hex: string): Triple {
  const [r, g, b] = hexToLinearRgb(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([lightness, a, b]: Triple): string {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const channel = (c: number) =>
    Math.round(Math.min(1, Math.max(0, toGamma(c))) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${rgb.map(channel).join("")}`;
}

const STOPS_OKLAB = RISK_STOPS.map(toOklab);

/** The colour for a probability in [0, 1]; the no-estimate grey when there is none. */
export function riskColor(probability: number | null | undefined): string {
  if (probability === null || probability === undefined || Number.isNaN(probability)) {
    return NO_ESTIMATE_COLOR;
  }
  const position = Math.min(1, Math.max(0, probability)) * (RISK_STOPS.length - 1);
  if (Number.isInteger(position)) return RISK_STOPS[position]; // exactly on a stop
  const index = Math.floor(position);
  const share = position - index;
  const from = STOPS_OKLAB[index];
  const to = STOPS_OKLAB[index + 1];
  return fromOklab(from.map((value, i) => value + (to[i] - value) * share) as Triple);
}

/** WCAG relative luminance of a hex colour, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToLinearRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The scale as a CSS gradient for the legend, sampled so it matches riskColor exactly. */
export const RISK_GRADIENT = `linear-gradient(to right, ${Array.from({ length: 11 }, (_, i) =>
  riskColor(i / 10),
).join(", ")})`;
