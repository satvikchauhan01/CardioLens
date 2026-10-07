// User-facing copy. The safety text is exact (PRODUCT_SPEC §9): change it only together with the spec.

export const APP_NAME = "CardioLens";
export const TAGLINE = "Coronary risk estimates, mapped to the vessels they describe.";

export const DISCLAIMER_BANNER =
  "Educational and decision-support prototype. Estimates come from a model trained on a small public research dataset (303 patients). They are not a diagnosis and not a substitute for clinical evaluation or diagnostic imaging such as coronary angiography.";

export const TABS = [
  { id: "analysis", label: "Patient analysis" },
  { id: "method", label: "Model & method" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export const FOOTER_DATASET =
  "Dataset: “extention of Z-Alizadeh sani dataset”, Alizadehsani, Roshanzamir & Sani (2013), UCI Machine Learning Repository, CC BY 4.0.";
export const FOOTER_NOTE = "Educational prototype";

export const VIEW_NOT_BUILT = "This view has not been built yet.";
