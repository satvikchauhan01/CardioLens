// Which of an artery's label anchors to use. An artery can wrap around the heart or pass under
// another structure, so its label sits on whichever anchor the camera can actually see.

import type { VesselId } from "../config/vessels";

/** The page's label elements, by vessel. The scene only moves them. */
export type LabelElements = Partial<Record<VesselId, HTMLElement | null>>;

export const FACING_ENOUGH = 0.25; // how squarely an anchor must face the camera to carry the label

/**
 * Index of the anchor to use, or null when none can be seen (the label is then hidden).
 * The anchor in use is kept while it stays usable, so the label does not jump between anchors.
 * `hidden` is only asked about anchors that face the camera, since it is the expensive check.
 */
export function chooseAnchor(
  count: number,
  current: number | null,
  facing: (index: number) => number,
  hidden: (index: number) => boolean,
): number | null {
  if (current !== null && current < count && facing(current) > FACING_ENOUGH && !hidden(current)) return current;
  let best: number | null = null;
  let bestFacing = FACING_ENOUGH;
  for (let index = 0; index < count; index += 1) {
    if (index === current) continue;
    const value = facing(index);
    if (value > bestFacing && !hidden(index)) {
      best = index;
      bestFacing = value;
    }
  }
  return best;
}
