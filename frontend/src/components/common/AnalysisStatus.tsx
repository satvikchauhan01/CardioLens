// The small status shown beside a panel title while its content is not up to date.

import { OUT_OF_DATE, OUT_OF_DATE_INVALID, UPDATING } from "../../config/copy";
import type { AnalysisState } from "../../state/analysisReducer";
import { Badge, Spinner } from "./Feedback";

export function AnalysisStatus({ status }: { status: AnalysisState["status"] }) {
  if (status === "predicting") return <Spinner label={UPDATING} />;
  if (status === "input_invalid") return <Badge>{OUT_OF_DATE_INVALID}</Badge>;
  if (status === "error") return <Badge>{OUT_OF_DATE}</Badge>;
  return null;
}
