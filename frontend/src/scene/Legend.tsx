// The colour scale and what it means (F5, F10, PRODUCT_SPEC §9.3).

import { LEGEND_NOTE, LEGEND_NO_ESTIMATE, LEGEND_RIM_INSIDE, LEGEND_RIM_INTRO, LEGEND_TITLE } from "../config/copy";
import { NO_ESTIMATE_COLOR, RISK_GRADIENT } from "../config/risk";

export interface RimKey {
  id: string;
  label: string; // "LAD"
  color: string;
  name: string; // "blue"
}

/** `rims`: the rim colour of each artery, which tells the three apart whatever their estimates. */
export function Legend({ rims = [] }: { rims?: RimKey[] }) {
  return (
    <div>
      <div className="flex items-end gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink">{LEGEND_TITLE}</p>
          {/* A light rim: on the dark theme the scale's dark end would otherwise run into the card. */}
          <div aria-hidden="true" className="mt-1 rounded-full bg-track p-px">
            <div className="h-2.5 rounded-full" style={{ backgroundImage: RISK_GRADIENT }} />
          </div>
          <div className="mt-0.5 flex justify-between text-xs tabular-nums text-ink-muted">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>
        <p className="flex shrink-0 items-center gap-1.5 pb-4 text-xs text-ink-muted">
          <span
            aria-hidden="true"
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: NO_ESTIMATE_COLOR }}
          />
          {LEGEND_NO_ESTIMATE}
        </p>
      </div>
      {rims.length > 0 && (
        <p data-rim-key="" className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span>{LEGEND_RIM_INTRO}</span>
          {rims.map((rim) => (
            <span key={rim.id} className="inline-flex items-center gap-1 text-ink">
              <span
                aria-hidden="true"
                className="inline-block size-2.5 rounded-full ring-1 ring-line"
                style={{ backgroundColor: rim.color }}
              />
              {rim.label} <span className="text-ink-muted">({rim.name})</span>
            </span>
          ))}
          <span>{LEGEND_RIM_INSIDE}</span>
        </p>
      )}
      <p className="mt-1 text-xs text-ink-muted">{LEGEND_NOTE}</p>
    </div>
  );
}
