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
  // The views follow the heart model: the LCX trunk comes into sight on the back, and most of the
  // RCA lies along the right border as seen from the front.
  { id: "lad", objectName: "artery-lad", preferredView: "front" },
  { id: "lcx", objectName: "artery-lcx", preferredView: "back" },
  { id: "rca", objectName: "artery-rca", preferredView: "front" },
];

export function isVesselId(id: string): id is VesselId {
  return VESSELS.some((vessel) => vessel.id === id);
}

/**
 * URL of the heart model, built by tools/heart_model/build_heart.py. It holds the heart and one
 * mesh per vessel, named by `objectName` above. With null, or when the file cannot be used, the
 * viewer draws the stand-in heart instead (F11).
 */
export const HEART_MODEL_URL: string | null = "/models/heart.glb";
