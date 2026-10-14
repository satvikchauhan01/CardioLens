// The overall estimate as a half-circle gauge: the same risk colour as everywhere else (BR-5),
// with a mark at the decision threshold (BR-3). The percentage itself is the caller's text; the
// drawing adds nothing a reader of the text would miss.

import type { ReactNode } from "react";
import { THRESHOLD_MARK } from "../../config/copy";
import { riskColor } from "../../config/risk";
import { DECISION_THRESHOLD, percentPoints } from "../../utils/format";

const ARC = "M 16 100 A 84 84 0 0 1 184 100"; // left end 0%, top 50%, right end 100%
const STROKE = 14;

interface RiskGaugeProps {
  target: string; // target id, for the element that carries the risk colour
  probability: number;
  children: ReactNode; // the percentage, drawn inside the arc
}

export function RiskGauge({ target, probability, children }: RiskGaugeProps) {
  const points = percentPoints(probability);
  // The mark sits on the arc where the threshold is: at the top for 0.5.
  const angle = Math.PI * (1 - DECISION_THRESHOLD);
  const inward = { x: 100 + 70 * Math.cos(angle), y: 100 - 70 * Math.sin(angle) };
  const outward = { x: 100 + 98 * Math.cos(angle), y: 100 - 98 * Math.sin(angle) };

  return (
    <span className="relative mx-auto block w-56 max-w-full">
      <svg aria-hidden="true" focusable="false" viewBox="0 0 200 112" className="block w-full">
        <path d={ARC} pathLength={100} fill="none" stroke="var(--color-track)" strokeWidth={STROKE} strokeLinecap="round" />
        <path
          data-risk-bar={target}
          d={ARC}
          pathLength={100}
          fill="none"
          stroke={riskColor(probability)}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${points} 100`}
          className="transition-[stroke-dasharray,stroke] duration-500 motion-reduce:transition-none"
        />
        {/* The threshold: a dark line with a light edge, so it shows on the track and on the colour. */}
        <line x1={inward.x} y1={inward.y} x2={outward.x} y2={outward.y} stroke="var(--color-surface)" strokeWidth={5} strokeLinecap="round" />
        <line x1={inward.x} y1={inward.y} x2={outward.x} y2={outward.y} stroke="var(--color-ink)" strokeWidth={2} strokeLinecap="round" />
      </svg>
      {/* Drawn from an attribute, so the mark's text is no part of what the card says in words. */}
      <span
        aria-hidden="true"
        data-mark={THRESHOLD_MARK}
        className="pointer-events-none absolute left-1/2 top-[26%] -translate-x-1/2 text-[0.65rem] font-medium text-ink-muted after:content-[attr(data-mark)]"
      />
      <span className="absolute inset-x-0 bottom-0 block text-center text-4xl font-semibold tracking-tight text-ink tabular-nums">
        {children}
      </span>
    </span>
  );
}
