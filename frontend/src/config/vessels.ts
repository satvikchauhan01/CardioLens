// 3D-specific vessel registry (DATA_MODEL §8). Display labels come from /api/meta; the ids here
// are the same target ids the models, artifacts and API use (ARCHITECTURE §6, TC-3).

import type { TargetId } from "../api/types";

export type VesselId = Exclude<TargetId, "cad">;
export type ViewPresetId = "front" | "back" | "left" | "right";

export interface VesselConfig {
  id: VesselId;
  objectName: `artery-${VesselId}`; // the trunk of the artery in the heart model
  branchesObjectName: `artery-${VesselId}-branches`; // its branches, which take the same colour
  preferredView: ViewPresetId; // the view that shows this artery when it is chosen from the list
  /**
   * The colour of the artery's rim, its own and the same everywhere (heart, labels, list, legend),
   * so the three can be told apart when their risk colours are alike. Hues outside the risk
   * scale's (teal, amber, crimson). Checked as one set with the dataviz palette validator:
   * lightness band, chroma, contrast, and colour-vision separation (worst pair ΔE 9.7, deutan).
   */
  rimColor: string;
  rimColorName: string; // for the words next to the swatch
}

export const VESSELS: readonly VesselConfig[] = [
  // The views follow the heart model: the LCX trunk comes into sight on the back, and most of the
  // RCA lies along the right border as seen from the front.
  { id: "lad", objectName: "artery-lad", branchesObjectName: "artery-lad-branches", preferredView: "front", rimColor: "#2563eb", rimColorName: "blue" },
  { id: "lcx", objectName: "artery-lcx", branchesObjectName: "artery-lcx-branches", preferredView: "back", rimColor: "#a21caf", rimColorName: "magenta" },
  { id: "rca", objectName: "artery-rca", branchesObjectName: "artery-rca-branches", preferredView: "front", rimColor: "#15803d", rimColorName: "green" },
];

/** The rim colour of an artery; null for anything that is not one of the three (CAD). */
export function rimColorOf(id: string): string | null {
  return VESSELS.find((vessel) => vessel.id === id)?.rimColor ?? null;
}

export function isVesselId(id: string): id is VesselId {
  return VESSELS.some((vessel) => vessel.id === id);
}

/**
 * URL of the heart model, built by tools/heart_model/build_heart.py. It holds the heart and, for
 * each vessel, the two meshes named above. With null, or when the file cannot be used, the viewer
 * draws the stand-in heart instead (F11).
 */
export const HEART_MODEL_URL: string | null = "/models/heart.glb";
