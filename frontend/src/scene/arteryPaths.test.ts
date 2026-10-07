import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";
import { VESSELS } from "../config/vessels";
import { META } from "../test/fixtures";
import { ARTERY_PATHS, arteryPath } from "./arteryPaths";
import { axisAt, buildHeartMesh, frontOutline, HEART_HEIGHT, isAnterior, surfaceNormal, surfacePoint } from "./heartShape";
import { VIEWS } from "./ViewPresets";

const interactiveIds = ARTERY_PATHS.filter((path) => path.interactive).map((path) => path.id);
const points = (id: "lad" | "lcx" | "rca" | "left_main") => arteryPath(id)!.points;

describe("model outputs ↔ displayed vessels (TC-3)", () => {
  it("uses the same ids in the API targets, the vessel registry and the artery paths", () => {
    const vesselTargets = META.targets.filter((target) => target.kind === "vessel").map((target) => target.id);

    expect(VESSELS.map((vessel) => vessel.id)).toEqual(vesselTargets);
    expect(interactiveIds).toEqual(vesselTargets);
    expect(vesselTargets).toEqual(["lad", "lcx", "rca"]);
  });

  it("names each 3D object after its target id", () => {
    for (const vessel of VESSELS) {
      expect(vessel.objectName).toBe(`artery-${vessel.id}`);
      expect(Object.keys(VIEWS)).toContain(vessel.preferredView);
    }
    expect(new Set(VESSELS.map((vessel) => vessel.objectName)).size).toBe(VESSELS.length);
  });

  it("has one neutral trunk that cannot be selected and is not a prediction target", () => {
    const others = ARTERY_PATHS.filter((path) => !path.interactive);

    expect(others.map((path) => path.id)).toEqual(["left_main"]);
    expect(META.targets.map((target) => target.id as string)).not.toContain("left_main");
  });

  it("gives every path usable geometry", () => {
    for (const path of ARTERY_PATHS) {
      expect(path.points.length).toBeGreaterThan(3);
      expect(path.radius).toBeGreaterThan(0);
      expect(path.points.flat().every(Number.isFinite)).toBe(true);
      expect(path.labelAnchors.length > 0).toBe(path.interactive);
      for (const anchor of path.labelAnchors) {
        expect(Math.hypot(...anchor.normal)).toBeCloseTo(1, 6);
      }
    }
  });

  it("can label every artery from the front, and LCX and RCA from the back as well", () => {
    const facing = (id: "lad" | "lcx" | "rca", towards: [number, number, number]) =>
      Math.max(...arteryPath(id)!.labelAnchors.map(({ normal }) => normal[0] * towards[0] + normal[1] * towards[1] + normal[2] * towards[2]));

    for (const id of ["lad", "lcx", "rca"] as const) {
      expect(facing(id, [0, 0, 1])).toBeGreaterThan(0.25);
    }
    expect(facing("lcx", [0, 0, -1])).toBeGreaterThan(0.25);
    expect(facing("rca", [0, 0, -1])).toBeGreaterThan(0.25);
    expect(facing("lad", [0, 0, -1])).toBeLessThan(0);
  });
});

describe("artery courses follow the problem statement", () => {
  it("LAD runs down the front of the heart to the apex", () => {
    const lad = points("lad");

    expect(lad.every(isAnterior)).toBe(true);
    expect(lad[0][1]).toBeGreaterThan(0.5);
    expect(lad[lad.length - 1][1]).toBeLessThan(-0.9);
  });

  it("LCX goes around the patient's left side to the back", () => {
    const lcx = points("lcx");
    const last = lcx[lcx.length - 1];

    expect(Math.max(...lcx.map((point) => point[0]))).toBeGreaterThan(0.8);
    expect(isAnterior(lcx[0])).toBe(true);
    expect(isAnterior(last)).toBe(false);
  });

  it("RCA goes around the patient's right side to the back and down towards the bottom", () => {
    const rca = points("rca");
    const last = rca[rca.length - 1];

    expect(Math.min(...rca.map((point) => point[0]))).toBeLessThan(-0.8);
    expect(isAnterior(rca[0])).toBe(true);
    expect(isAnterior(last)).toBe(false);
    expect(last[1]).toBeLessThan(-0.3);
  });

  it("the left main ends where the LAD and the LCX begin", () => {
    const end = points("left_main")[points("left_main").length - 1];

    for (const start of [points("lad")[0], points("lcx")[0]]) {
      expect(Math.hypot(start[0] - end[0], start[1] - end[1], start[2] - end[2])).toBeLessThan(0.02);
    }
  });

  it("keeps the three arteries apart", () => {
    const pairs: ["lad" | "lcx" | "rca", "lad" | "lcx" | "rca"][] = [["lad", "rca"], ["lcx", "rca"]];
    for (const [a, b] of pairs) {
      const nearest = Math.min(
        ...points(a).flatMap((p) => points(b).map((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))),
      );
      expect(nearest).toBeGreaterThan(0.3);
    }
  });
});

describe("stand-in heart shape", () => {
  it("has outward normals and triangles wound to face outwards", () => {
    for (const around of [0, 45, 90, 180, 270]) {
      for (const down of [0.1, 0.4, 0.8]) {
        const point = surfacePoint(around, down);
        const axis = axisAt(down);
        const normal = surfaceNormal(around, down);
        const outward = [point[0] - axis[0], 0, point[2] - axis[2]];
        expect(normal[0] * outward[0] + normal[2] * outward[2]).toBeGreaterThan(0);
      }
    }

    const { positions, normals, indices } = buildHeartMesh(12, 16);
    const vertex = (index: number) => new Vector3().fromArray(positions, index * 3);
    for (let triangle = 0; triangle < indices.length; triangle += 3) {
      const [a, b, c] = [indices[triangle], indices[triangle + 1], indices[triangle + 2]].map(vertex);
      const face = b.clone().sub(a).cross(c.clone().sub(a));
      if (face.length() < 1e-6) continue; // the collapsed triangles at the two poles
      const supplied = new Vector3().fromArray(normals, indices[triangle] * 3);
      expect(face.normalize().dot(supplied)).toBeGreaterThan(0);
    }
  });

  it("stands upright with the apex low, to the patient's left and forward", () => {
    const top = axisAt(0);
    const apex = axisAt(1);

    expect(top[1] - apex[1]).toBeCloseTo(HEART_HEIGHT, 6);
    expect(apex[0]).toBeGreaterThan(top[0]);
    expect(apex[2]).toBeGreaterThan(top[2]);
  });

  it("draws a closed front outline", () => {
    const outline = frontOutline(20);

    expect(outline).toHaveLength(42);
    expect(outline.flat().every(Number.isFinite)).toBe(true);
  });
});

describe("picking", () => {
  // The same objects the viewer builds: the heart body and each artery's pointer shell.
  const heartData = buildHeartMesh();
  const body = new BufferGeometry();
  body.setAttribute("position", new BufferAttribute(heartData.positions, 3));
  body.setIndex(heartData.indices);
  const heart = new Mesh(body, new MeshBasicMaterial());
  heart.name = "heart";
  const shells = ARTERY_PATHS.filter((path) => path.interactive).map((path) => {
    const curve = new CatmullRomCurve3(path.points.map((point) => new Vector3(...point)), false, "centripetal");
    const shell = new Mesh(new TubeGeometry(curve, 48, path.radius * 2.6, 8, false), new MeshBasicMaterial());
    shell.name = path.id;
    return shell;
  });

  function firstHit(cameraPosition: Vector3, towards: Vector3): string | undefined {
    const camera = new PerspectiveCamera(35, 1, 0.5, 40);
    camera.position.copy(cameraPosition);
    camera.lookAt(towards);
    camera.updateMatrixWorld();
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(0, 0), camera);
    return raycaster.intersectObjects([heart, ...shells], false)[0]?.object.name;
  }

  const middleOf = (id: "lad" | "lcx" | "rca") => new Vector3(...points(id)[Math.floor(points(id).length / 2)]);

  it("an artery in view is picked before the heart", () => {
    expect(firstHit(new Vector3(0, 0, 7), middleOf("lad"))).toBe("lad");
    expect(firstHit(new Vector3(7, 0.5, 0), middleOf("lcx"))).toBe("lcx");
    expect(firstHit(new Vector3(-7, 0.5, 0), middleOf("rca"))).toBe("rca");
  });

  it("the heart hides an artery behind it", () => {
    const lowRca = new Vector3(...points("rca")[points("rca").length - 1]);

    expect(firstHit(new Vector3(0.25, lowRca.y, 7), lowRca)).toBe("heart");
    expect(firstHit(new Vector3(0.25, lowRca.y, -7), lowRca)).toBe("rca");
  });
});
