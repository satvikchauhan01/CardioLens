// Passes /api/meta down the tree once the app has booted (ARCHITECTURE §5).

import { createContext, useContext } from "react";
import type { FeatureSchema, MetaResponse } from "../api/types";

export const MetaContext = createContext<MetaResponse | null>(null);

export function useMeta(): MetaResponse {
  const meta = useContext(MetaContext);
  if (!meta) throw new Error("useMeta must be used after the app has booted.");
  return meta;
}

export function featureById(meta: MetaResponse, id: string): FeatureSchema | undefined {
  return meta.features.find((feature) => feature.id === id);
}
