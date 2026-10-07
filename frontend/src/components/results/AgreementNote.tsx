// BR-6: a neutral note when the overall model and the vessel models disagree.

import type { PredictResponse } from "../../api/types";

export function AgreementNote({ agreement }: { agreement: PredictResponse["agreement"] }) {
  if (agreement.consistent || !agreement.message) return null;
  return (
    <p role="note" className="rounded-lg border border-line bg-canvas p-3 text-xs text-ink">
      {agreement.message}
    </p>
  );
}
