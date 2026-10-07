// The stand-in heart as plain math, shared by the 3D mesh, the artery paths and the 2D schematic.
// It is a stylised shape, not anatomy: a rounded body that tapers to an apex.
//
// Axes (front view): +x is the patient's left (the viewer's right), +y is up, +z points at the viewer.
// The surface is addressed by `around`, the angle about the long axis in degrees (0 = front,
// 90 = patient's left, 180 = back, -90 = patient's right) and `down`, 0 at the top to 1 at the apex.

export type Vec3 = [number, number, number];

export const HEART_HEIGHT = 2.4;
const MAX_RADIUS = 0.95;
const DEPTH_RATIO = 0.85; // front-to-back is a little flatter than side-to-side

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Body radius at a height: zero at the top, widest about a third of the way down, zero at the apex. */
function radiusAt(down: number): number {
  const clamped = Math.min(1, Math.max(0, down));
  return MAX_RADIUS * Math.sin(Math.PI * clamped ** 0.62) ** 0.9;
}

/** The long axis leans, so the apex ends up low, to the patient's left and slightly forward. */
export function axisAt(down: number): Vec3 {
  return [-0.1 + 0.55 * down ** 1.3, HEART_HEIGHT / 2 - down * HEART_HEIGHT, -0.05 + 0.25 * down ** 1.5];
}

export function surfacePoint(around: number, down: number): Vec3 {
  const [x, y, z] = axisAt(down);
  const radius = radiusAt(down);
  return [x + radius * Math.sin(radians(around)), y, z + radius * DEPTH_RATIO * Math.cos(radians(around))];
}

const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

/** Outward unit normal, from finite differences of the surface. */
export function surfaceNormal(around: number, down: number): Vec3 {
  const d = 0.004;
  const low = Math.max(d, down - d);
  const high = Math.min(1 - d, down + d);
  const alongAround = subtract(surfacePoint(around + 0.5, down), surfacePoint(around - 0.5, down));
  const alongDown = subtract(surfacePoint(around, high), surfacePoint(around, low));
  // alongDown × alongAround points out of the body.
  return normalize([
    alongDown[1] * alongAround[2] - alongDown[2] * alongAround[1],
    alongDown[2] * alongAround[0] - alongDown[0] * alongAround[2],
    alongDown[0] * alongAround[1] - alongDown[1] * alongAround[0],
  ]);
}

/** A point lifted off the surface along its normal, e.g. the centre line of a vessel lying on it. */
export function liftedPoint(around: number, down: number, lift: number): Vec3 {
  const point = surfacePoint(around, down);
  const normal = surfaceNormal(around, down);
  return [point[0] + normal[0] * lift, point[1] + normal[1] * lift, point[2] + normal[2] * lift];
}

/** True when a point of the model lies on the front half of the body at its height. */
export function isAnterior(point: Vec3): boolean {
  const down = (HEART_HEIGHT / 2 - point[1]) / HEART_HEIGHT;
  return point[2] >= axisAt(Math.min(1, Math.max(0, down)))[2];
}

export interface SurfaceMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: number[];
}

/** Triangle mesh of the body: `rings` steps from top to apex, `segments` around. */
export function buildHeartMesh(rings = 48, segments = 64): SurfaceMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    // Stay a hair inside the two poles, where the surface closes to a point.
    const down = Math.min(0.999, Math.max(0.001, ring / rings));
    for (let segment = 0; segment <= segments; segment += 1) {
      const around = (segment / segments) * 360;
      positions.push(...surfacePoint(around, down));
      normals.push(...surfaceNormal(around, down));
    }
  }
  const stride = segments + 1;
  for (let ring = 0; ring < rings; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = ring * stride + segment;
      const b = a + stride;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices };
}

/** Front-view outline of the body as [x, y] points, clockwise from the top. */
export function frontOutline(steps = 60): [number, number][] {
  const leftSide: [number, number][] = [];
  const rightSide: [number, number][] = [];
  for (let step = 0; step <= steps; step += 1) {
    const down = step / steps;
    const [x, y] = axisAt(down);
    const radius = radiusAt(down);
    rightSide.push([x + radius, y]);
    leftSide.push([x - radius, y]);
  }
  return [...rightSide, ...leftSide.reverse()];
}

/** Neutral great-vessel stubs on top of the body, for recognisability only. */
export const GREAT_VESSELS: readonly { id: string; radius: number; points: Vec3[] }[] = [
  {
    id: "aorta",
    radius: 0.2,
    points: [[-0.1, 0.92, -0.06], [-0.1, 1.38, -0.04], [0.04, 1.74, -0.12], [0.36, 1.9, -0.28], [0.7, 1.78, -0.44]],
  },
  {
    id: "pulmonary-trunk",
    radius: 0.17,
    points: [[0.16, 0.9, 0.3], [0.2, 1.3, 0.3], [0.36, 1.58, 0.14], [0.6, 1.7, -0.08]],
  },
  {
    id: "vena-cava",
    radius: 0.13,
    points: [[-0.52, 0.86, -0.12], [-0.54, 1.3, -0.14], [-0.54, 1.66, -0.14]],
  },
];
