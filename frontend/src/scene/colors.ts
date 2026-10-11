// Colours of the heart scene and its 2D fallback that are not risk colours. Risk colours are
// reserved for risk and live in config/risk.ts (BR-5). No imports here: the 2D schematic uses
// these without pulling three.js into the first bundle.
//
// The heart has the colours of a heart, and the risk scale runs from teal through amber to
// crimson, so the two meet in the reds. Two things keep the arteries apart from the heart:
// the heart's tones are lighter than every colour of the scale (colors.test.ts measures the
// distance), and every artery is drawn with a dark outline, which does not depend on telling
// colours apart at all.

/** The heart model's regions (heartModelData.ts, MODEL_HEART_REGIONS) and their colours. */
export const HEART_REGION_COLORS = {
  ventricle: "#e09d97", // the muscle of the two ventricles
  atrium: "#d5a4b2", // the atria and their auricles, cooler: towards mauve
  great_vessel: "#f0d9cd", // the roots of the aorta and the pulmonary trunk, pale as they are in life
} as const;

export const HEART_COLOR = HEART_REGION_COLORS.ventricle; // the stand-in heart and the 2D schematic
export const HEART_OUTLINE_COLOR = "#c47f7a"; // edge of the flat heart in the 2D schematic
export const GREAT_VESSEL_COLOR = HEART_REGION_COLORS.great_vessel; // the stand-in heart's aorta, pulmonary trunk and vena cava
// The stand-in heart's left main stem: drawn, but not one of the three estimated vessels.
export const NEUTRAL_VESSEL_COLOR = "#64748b";
// Around every artery, always: it keeps a vessel readable on the heart whatever its risk colour.
export const ARTERY_OUTLINE_COLOR = "#3b141c";
export const SELECTED_OUTLINE_COLOR = "#0f172a"; // the page's ink colour
export const HOVERED_OUTLINE_COLOR = "#0369a1"; // the page's brand colour
