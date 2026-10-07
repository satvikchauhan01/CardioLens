// View presets (F5): the camera positions and the buttons that ask for them.

import type { ViewPresetId } from "../config/vessels";
import { BUTTON_CLASS } from "../components/common/Feedback";

export type ViewId = ViewPresetId | "reset";

/** A request to move the camera; a new `nonce` repeats the same view. */
export interface ViewRequest {
  view: ViewId;
  nonce: number;
}

/** Camera placement around the heart: `azimuth` turns about the vertical axis from the front
 *  towards the patient's left, `polar` is measured from straight above. Degrees. */
export const VIEWS: Record<ViewId, { azimuth: number; polar: number }> = {
  reset: { azimuth: 22, polar: 80 },
  front: { azimuth: 0, polar: 86 },
  back: { azimuth: 180, polar: 86 },
  left: { azimuth: 90, polar: 86 },
  right: { azimuth: -90, polar: 86 },
};

export const CAMERA_TARGET: [number, number, number] = [0.05, 0.3, 0];
export const CAMERA_DISTANCE = 6.8;
export const VIEW_TRANSITION_SECONDS = 0.4;

const BUTTONS: { view: ViewId; label: string; title: string }[] = [
  { view: "front", label: "Front", title: "View from the front" },
  { view: "back", label: "Back", title: "View from the back" },
  { view: "left", label: "Left", title: "View from the patient's left" },
  { view: "right", label: "Right", title: "View from the patient's right" },
  { view: "reset", label: "Reset view", title: "Back to the starting view" },
];

export function ViewPresets({ onRequestView }: { onRequestView: (view: ViewId) => void }) {
  return (
    <div role="group" aria-label="View" className="flex flex-wrap gap-1.5">
      {BUTTONS.map((button) => (
        <button
          key={button.view}
          type="button"
          title={button.title}
          aria-label={button.title}
          onClick={() => onRequestView(button.view)}
          className={`${BUTTON_CLASS} px-2.5 py-1 text-xs`}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}
