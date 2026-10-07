// F1: the held-out sample patients and "Start from typical values".

import type { SamplePatient } from "../../api/types";
import { SAMPLES_LABEL, TYPICAL_NOTE, TYPICAL_VALUES } from "../../config/copy";

interface SamplePickerProps {
  samples: SamplePatient[];
  source: "sample" | "typical" | null;
  sampleId: string | null;
  onLoadSample: (sample: SamplePatient) => void;
  onLoadTypical: () => void;
}

const CHOICE_CLASS =
  "cursor-pointer rounded-lg border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const CHOSEN = "border-brand bg-brand-soft";
const NOT_CHOSEN = "border-line bg-surface hover:border-brand";

export function SamplePicker({
  samples,
  source,
  sampleId,
  onLoadSample,
  onLoadTypical,
}: SamplePickerProps) {
  const loaded = samples.find((sample) => source === "sample" && sample.id === sampleId);

  return (
    <div>
      <div role="group" aria-label={SAMPLES_LABEL} className="grid grid-cols-2 gap-2">
        {samples.map((sample) => {
          const chosen = sample === loaded;
          return (
            <button
              key={sample.id}
              type="button"
              aria-pressed={chosen}
              onClick={() => onLoadSample(sample)}
              className={`${CHOICE_CLASS} ${chosen ? CHOSEN : NOT_CHOSEN}`}
            >
              <span className="block text-sm font-medium text-ink">{sample.title}</span>
              <span className="block text-xs text-ink-muted">{sample.subtitle}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        aria-pressed={source === "typical"}
        onClick={onLoadTypical}
        className={`mt-2 w-full text-sm font-medium text-ink ${CHOICE_CLASS} ${
          source === "typical" ? CHOSEN : NOT_CHOSEN
        }`}
      >
        {TYPICAL_VALUES}
      </button>
      {(loaded || source === "typical") && (
        <p className="mt-2 text-xs text-ink-muted">{loaded ? loaded.note : TYPICAL_NOTE}</p>
      )}
    </div>
  );
}
