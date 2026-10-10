// Colours of the heart scene and its 2D fallback that are not risk colours. Risk colours are
// reserved for risk and live in config/risk.ts (BR-5). No imports here: the 2D schematic uses
// these without pulling three.js into the first bundle.

export const HEART_COLOR = "#e9e4df";
export const HEART_OUTLINE_COLOR = "#cfc8c1"; // edge of the flat heart in the 2D schematic
export const GREAT_VESSEL_COLOR = "#dad4ce"; // the stand-in heart's aorta, pulmonary trunk and vena cava
// The stand-in heart's left main stem: drawn, but not one of the three estimated vessels.
export const NEUTRAL_VESSEL_COLOR = "#64748b";
export const SELECTED_OUTLINE_COLOR = "#0f172a"; // the page's ink colour
export const HOVERED_OUTLINE_COLOR = "#0369a1"; // the page's brand colour
