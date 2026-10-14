import { describe, expect, it } from "vitest";
import { colorDistance, NO_ESTIMATE_COLOR, relativeLuminance, riskColor } from "../config/risk";
import { VESSELS } from "../config/vessels";
import { ARTERY_OUTLINE_COLOR, HEART_COLOR, HEART_REGION_COLORS, SELECTED_OUTLINE_COLOR } from "./colors";
import { MODEL_HEART_REGIONS } from "./heartModelData";

// Every colour an artery can take: the scale in steps of 5%, and the grey of "no estimate".
const SCALE = Array.from({ length: 21 }, (_, step) => riskColor(step / 20));
const ARTERY_COLORS = [...SCALE, NO_ESTIMATE_COLOR];
const HEART_COLORS = Object.values(HEART_REGION_COLORS);

const nearest = (color: string, among: readonly string[]) => Math.min(...among.map((other) => colorDistance(color, other)));

describe("colours of the heart against the colours of the arteries", () => {
  it("has a colour for every region the heart model marks, and no other", () => {
    expect(Object.keys(HEART_REGION_COLORS).sort()).toEqual([...MODEL_HEART_REGIONS].sort());
    expect(HEART_COLOR).toBe(HEART_REGION_COLORS.ventricle);
  });

  it("measures colours as the eye does: nothing for the same colour, most for black against white", () => {
    expect(colorDistance("#e09d97", "#e09d97")).toBe(0);
    expect(colorDistance("#000000", "#ffffff")).toBeCloseTo(100, 0);
    expect(colorDistance("#14b8a6", "#881337")).toBeGreaterThan(40);
  });

  it("keeps every part of the heart plainly apart from every colour of the risk scale", () => {
    // The heart is red and so is the top of the scale: this is the test that keeps them apart.
    for (const heart of HEART_COLORS) expect(nearest(heart, SCALE)).toBeGreaterThan(15);
  });

  it("makes the heart lighter than the whole risk scale, so a higher estimate is always darker on it", () => {
    const lightestOnScale = Math.max(...SCALE.map(relativeLuminance));
    for (const heart of HEART_COLORS) expect(relativeLuminance(heart)).toBeGreaterThan(lightestOnScale);
  });

  it("gives the arteries an edge that stands out from the heart and from every artery colour", () => {
    // The edge is what still separates an artery from the heart when their colours cannot be told
    // apart, as teal and rose cannot with a red-green colour-vision deficiency. It works by
    // lightness alone: far darker than the heart, and darker than the darkest artery colour.
    for (const edge of [ARTERY_OUTLINE_COLOR, SELECTED_OUTLINE_COLOR]) {
      expect(nearest(edge, HEART_COLORS)).toBeGreaterThan(45);
    }
    expect(nearest(ARTERY_OUTLINE_COLOR, ARTERY_COLORS)).toBeGreaterThan(15);
    const darkest = Math.min(...ARTERY_COLORS.map(relativeLuminance));
    expect(relativeLuminance(ARTERY_OUTLINE_COLOR)).toBeLessThan(darkest / 2);
    expect(relativeLuminance(HEART_REGION_COLORS.ventricle)).toBeGreaterThan(20 * relativeLuminance(ARTERY_OUTLINE_COLOR));
  });

  it("tells the three regions of the heart apart, the great vessels most of all", () => {
    const { ventricle, atrium, great_vessel } = HEART_REGION_COLORS;

    expect(colorDistance(ventricle, atrium)).toBeGreaterThan(3);
    expect(colorDistance(ventricle, great_vessel)).toBeGreaterThan(12);
    expect(colorDistance(atrium, great_vessel)).toBeGreaterThan(12);
  });
});

describe("the rim colour of each artery", () => {
  const RIMS = VESSELS.map((vessel) => ({ id: vessel.id, color: vessel.rimColor }));

  it("has one colour per artery, and no two alike", () => {
    expect(RIMS.map((rim) => rim.id)).toEqual(["lad", "lcx", "rca"]);
    for (const rim of RIMS) expect(rim.color).toMatch(/^#[0-9a-f]{6}$/);
    for (const a of RIMS) {
      for (const b of RIMS.filter((other) => other.id > a.id)) {
        expect(colorDistance(a.color, b.color), `${a.id} and ${b.id}`).toBeGreaterThan(20);
      }
    }
  });

  it("is plainly apart from the heart, and darker than every part of it", () => {
    for (const { color } of RIMS) {
      expect(nearest(color, HEART_COLORS)).toBeGreaterThan(28);
      for (const heart of HEART_COLORS) expect(relativeLuminance(heart)).toBeGreaterThan(2 * relativeLuminance(color));
    }
  });

  it("is not a colour of the risk scale, so that a rim is never read as an estimate", () => {
    for (const { color } of RIMS) {
      expect(nearest(color, SCALE), color).toBeGreaterThan(12);
      expect(colorDistance(color, NO_ESTIMATE_COLOR), color).toBeGreaterThan(20);
    }
  });

  it("is named, for the words that stand beside its swatch", () => {
    expect(VESSELS.map((vessel) => vessel.rimColorName)).toEqual(["blue", "magenta", "green"]);
  });
});

