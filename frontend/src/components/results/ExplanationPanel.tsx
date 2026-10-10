// F6: the selected target's own explanation (SHAP contributions summed to the clinical inputs).

import { useState } from "react";
import type { Explanation, TargetInfo } from "../../api/types";
import {
  EXPLANATION_HEADING,
  EXPLANATION_LEGEND,
  EXPLANATION_METHOD,
  MODEL_TYPE_LABELS,
} from "../../config/copy";
import { featureById, useMeta } from "../../state/MetaContext";
import { BUTTON_CLASS } from "../common/Feedback";
import { ContributionBar } from "./ContributionBar";

const TOP_CONTRIBUTIONS = 8;

interface ExplanationPanelProps {
  target: TargetInfo;
  explanation: Explanation;
}

export function ExplanationPanel({ target, explanation }: ExplanationPanelProps) {
  const meta = useMeta();
  const [showAll, setShowAll] = useState(false);

  // The API sends the contributions sorted by size, largest first.
  const { contributions } = explanation;
  const shown = showAll ? contributions : contributions.slice(0, TOP_CONTRIBUTIONS);
  const scale = Math.max(0, ...contributions.map((item) => Math.abs(item.relative)));
  const headingId = "explanation-heading";

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="text-sm font-semibold text-ink">
        {EXPLANATION_HEADING}: {target.short_label}
      </h3>
      <p className="text-xs text-ink-muted">
        {MODEL_TYPE_LABELS[explanation.model_type]} · {EXPLANATION_METHOD}
      </p>
      <p className="mt-2 text-sm text-ink">{explanation.summary}</p>
      <p className="mt-2 text-xs text-ink-muted">{EXPLANATION_LEGEND}</p>

      <ul className="mt-1 divide-y divide-line">
        {shown.map((contribution) => {
          const feature = featureById(meta, contribution.feature);
          return feature ? (
            <ContributionBar
              key={contribution.feature}
              contribution={contribution}
              feature={feature}
              scale={scale}
            />
          ) : null;
        })}
      </ul>

      {contributions.length > TOP_CONTRIBUTIONS && (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((current) => !current)}
          className={`mt-2 ${BUTTON_CLASS}`}
        >
          {showAll ? `Show top ${TOP_CONTRIBUTIONS}` : `Show all ${contributions.length}`}
        </button>
      )}
    </section>
  );
}
