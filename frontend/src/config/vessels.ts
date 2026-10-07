// 3D-specific vessel registry (DATA_MODEL §8). Display labels come from /api/meta; the ids here
// are the same target ids the models, artifacts and API use (ARCHITECTURE §6, TC-3).

import type { TargetId } from "../api/types";

export type VesselId = Exclude<TargetId, "cad">;
export type ViewPresetId = "front" | "back" | "left" | "right";

export interface VesselConfig {
  id: VesselId;
  objectName: `artery-${VesselId}`;
  preferredView: ViewPresetId; // the view that shows this artery when it is chosen from the list
}

export const VESSELS: readonly VesselConfig[] = [
  { id: "lad", objectName: "artery-lad", preferredView: "front" },
  { id: "lcx", objectName: "artery-lcx", preferredView: "left" },
  { id: "rca", objectName: "artery-rca", preferredView: "right" },
];

export function isVesselId(id: string): id is VesselId {
  return VESSELS.some((vessel) => vessel.id === id);
}

/**
 * URL of the optimized heart mesh, or null while there is none. With null the viewer draws the
 * stand-in heart directly. Set it to "/models/heart.glb" once the asset is in public/models/ and
 * the artery paths have been re-authored on it (BUILD_MAP T6.1, T6.2).
 */
export const HEART_MODEL_URL: string | null = null;
