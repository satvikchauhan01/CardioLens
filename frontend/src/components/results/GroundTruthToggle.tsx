// F8, BR-11: reveal the dataset's angiography labels for an unmodified held-out sample.

import {
  GROUND_TRUTH_NOTE,
  GROUND_TRUTH_TOGGLE,
  groundTruthSummary,
} from "../../config/copy";

export interface GroundTruthControl {
  checked: boolean;
  onChange: (checked: boolean) => void;
  unavailableReason: string | null; // why it cannot be shown now; null when it can
  matches: { matched: number; total: number } | null; // filled while the labels are shown
}

export function GroundTruthToggle({ checked, onChange, unavailableReason, matches }: GroundTruthControl) {
  const available = unavailableReason === null;
  const id = "ground-truth-toggle";

  return (
    <div className="rounded-lg border border-line bg-canvas p-3">
      <label
        htmlFor={id}
        title={unavailableReason ?? undefined}
        className={`flex items-center gap-2 text-sm font-medium ${
          available ? "cursor-pointer text-ink" : "cursor-not-allowed text-ink-muted"
        }`}
      >
        <input
          id={id}
          type="checkbox"
          checked={available && checked}
          disabled={!available}
          aria-describedby={`${id}-note`}
          onChange={(event) => onChange(event.target.checked)}
          className="size-4 accent-brand"
        />
        {GROUND_TRUTH_TOGGLE}
      </label>
      <p id={`${id}-note`} className="mt-1 text-xs text-ink-muted">
        {unavailableReason ?? GROUND_TRUTH_NOTE}
      </p>
      {matches && (
        <p className="mt-1 text-xs font-medium text-ink">
          {groundTruthSummary(matches.matched, matches.total)}
        </p>
      )}
    </div>
  );
}
