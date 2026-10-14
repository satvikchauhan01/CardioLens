// An estimate in whole percent (BR-14) that counts to its new value when it changes.

import { usePrefersReducedMotion } from "../../utils/environment";
import { formatPoints, percentPoints } from "../../utils/format";
import { useCountUp } from "../../utils/useCountUp";

export function AnimatedPercent({ probability }: { probability: number }) {
  const reducedMotion = usePrefersReducedMotion();
  return <>{formatPoints(useCountUp(percentPoints(probability), !reducedMotion))}</>;
}
