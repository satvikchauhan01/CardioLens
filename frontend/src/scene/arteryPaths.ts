// Artery centre lines as control points in the heart model's coordinate space (DATA_MODEL §8).
//
// The courses are schematic and follow the problem statement: LAD down the front, LCX around the
// side to the back, RCA around the right side to the bottom. They are drawn on the stand-in heart
// (heartShape.ts) and must be re-authored when a real mesh replaces it (BUILD_MAP T6.2).

import type { VesselId } from "../config/vessels";
import { liftedPoint, surfaceNormal, type Vec3 } from "./heartShape";

export interface LabelAnchor {
  point: Vec3; // where the label sits, a little off the surface
  normal: Vec3; // outward direction there; the anchor is usable while it faces the camera
}

export interface ArteryPath {
  id: VesselId | "left_main"; // left_main: the neutral, non-interactive trunk
  points: Vec3[];
  radius: number;
  interactive: boolean;
  // Places along the artery where its label may sit, the frontmost first. The viewer uses
  // whichever one faces the camera, so an artery that wraps around the heart stays labelled.
  labelAnchors: LabelAnchor[];
}

type SurfaceKey = [around: number, down: number];

const ARTERY_RADIUS = 0.042;
const LABEL_LIFT = 0.2;

/** Points along a course on the surface, dense enough that the tube follows the curvature. */
function alongSurface(keys: SurfaceKey[], radius: number): Vec3[] {
  const lift = radius * 0.6; // slightly sunk into the surface, like a vessel lying on it
  const points: Vec3[] = [liftedPoint(keys[0][0], keys[0][1], lift)];
  for (let index = 1; index < keys.length; index += 1) {
    const [fromAround, fromDown] = keys[index - 1];
    const [toAround, toDown] = keys[index];
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(toAround - fromAround) / 6, Math.abs(toDown - fromDown) / 0.04)));
    for (let step = 1; step <= steps; step += 1) {
      const share = step / steps;
      points.push(liftedPoint(fromAround + (toAround - fromAround) * share, fromDown + (toDown - fromDown) * share, lift));
    }
  }
  return points;
}

function artery(
  id: ArteryPath["id"],
  keys: SurfaceKey[],
  labelsAt: SurfaceKey[],
  radius = ARTERY_RADIUS,
): ArteryPath {
  return {
    id,
    points: alongSurface(keys, radius),
    radius,
    interactive: id !== "left_main",
    labelAnchors: labelsAt.map(([around, down]) => ({
      point: liftedPoint(around, down, LABEL_LIFT),
      normal: surfaceNormal(around, down),
    })),
  };
}

// The left main ends where the LAD and the LCX begin.
const BIFURCATION: SurfaceKey = [58, 0.185];

export const ARTERY_PATHS: readonly ArteryPath[] = [
  artery("left_main", [[38, 0.085], [48, 0.13], BIFURCATION], [], 0.05),
  // Front of the heart, down to the apex.
  artery(
    "lad",
    [BIFURCATION, [50, 0.26], [40, 0.36], [33, 0.48], [28, 0.6], [24, 0.72], [20, 0.84], [14, 0.94]],
    [[36, 0.42]],
  ),
  // Around the patient's left side to the back.
  artery(
    "lcx",
    [BIFURCATION, [75, 0.2], [95, 0.215], [115, 0.235], [135, 0.26], [148, 0.3], [150, 0.38], [150, 0.48]],
    [[66, 0.195], [118, 0.24], [150, 0.4]],
  ),
  // Around the patient's right side, then down the back towards the apex.
  artery(
    "rca",
    [[-32, 0.085], [-45, 0.14], [-62, 0.185], [-85, 0.205], [-110, 0.22], [-135, 0.24], [-160, 0.265], [-176, 0.31], [-180, 0.42], [-180, 0.56], [-178, 0.7]],
    [[-42, 0.13], [-100, 0.215], [-150, 0.255], [-180, 0.52]],
  ),
];

export function arteryPath(id: ArteryPath["id"]): ArteryPath | undefined {
  return ARTERY_PATHS.find((path) => path.id === id);
}
