import { describe, expect, it, vi } from "vitest";
import { chooseAnchor, FACING_ENOUGH } from "./labelAnchors";

const facingOf = (values: number[]) => (index: number) => values[index];
const never = () => false;

describe("choosing a label anchor", () => {
  it("keeps the anchor in use while it faces the camera and is not hidden", () => {
    expect(chooseAnchor(3, 1, facingOf([0.9, 0.3, 0.8]), never)).toBe(1);
  });

  it("moves to the anchor that faces the camera best once the one in use has turned away", () => {
    expect(chooseAnchor(3, 1, facingOf([0.5, FACING_ENOUGH, 0.8]), never)).toBe(2);
    expect(chooseAnchor(3, null, facingOf([0.5, 0.2, 0.4]), never)).toBe(0);
  });

  it("moves on when the anchor in use is hidden behind the heart", () => {
    const hidden = (index: number) => index === 1;

    expect(chooseAnchor(3, 1, facingOf([0.5, 0.9, 0.6]), hidden)).toBe(2);
  });

  it("passes over hidden anchors, even the one that faces the camera best", () => {
    const hidden = (index: number) => index === 2;

    expect(chooseAnchor(3, null, facingOf([0.3, 0.6, 0.9]), hidden)).toBe(1);
  });

  it("gives no anchor when none can be seen, so the label is hidden", () => {
    expect(chooseAnchor(3, 0, facingOf([0.1, -0.5, FACING_ENOUGH]), never)).toBeNull();
    expect(chooseAnchor(2, null, facingOf([0.9, 0.9]), () => true)).toBeNull();
    expect(chooseAnchor(0, null, facingOf([]), never)).toBeNull();
  });

  it("asks whether an anchor is hidden only when it faces the camera", () => {
    const hidden = vi.fn(() => false);

    chooseAnchor(4, null, facingOf([-0.4, 0.1, 0.7, 0.5]), hidden);

    // 0 and 1 face away; 3 faces less squarely than 2, which was already accepted.
    expect(hidden.mock.calls).toEqual([[2]]);
  });

  it("forgets an anchor in use that no longer exists", () => {
    expect(chooseAnchor(2, 5, facingOf([0.4, 0.6]), never)).toBe(1);
  });
});
