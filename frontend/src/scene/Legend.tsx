// The colour scale and what it means (F5, F10, PRODUCT_SPEC §9.3).

import { LEGEND_NOTE, LEGEND_NO_ESTIMATE, LEGEND_TITLE } from "../config/copy";
import { NO_ESTIMATE_COLOR, RISK_GRADIENT } from "../config/risk";

export function Legend() {
  return (
    <div>
      <div className="flex items-end gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink">{LEGEND_TITLE}</p>
          <div
            aria-hidden="true"
            className="mt-1 h-2.5 rounded-full"
            style={{ backgroundImage: RISK_GRADIENT }}
          />
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
      <p className="mt-1 text-xs text-ink-muted">{LEGEND_NOTE}</p>
    </div>
  );
}
