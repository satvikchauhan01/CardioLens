// The heart model as it is shipped: public/models/heart.glb together with heartModelData.ts.
// Both are written by tools/heart_model/build_heart.py; these tests fail if one is changed alone.

import { Mesh, MeshBasicMaterial, Raycaster, Vector3, type BufferGeometry, type Object3D } from "three";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { beforeAll, describe, expect, it } from "vitest";
import { HEART_MODEL_URL, VESSELS, type VesselId } from "../config/vessels";
import { META } from "../test/fixtures";
import { readProjectFile } from "../test/projectFile";
import type { ArteryPath } from "./arteryPaths";
import { MODEL_ARTERY_PATHS, MODEL_BOUNDS, MODEL_SOURCES, MODEL_UNITS_PER_MM } from "./heartModelData";
import {
  BRANCHES_OBJECT,
  HEART_OBJECT,
  inflated,
  LEFT_MAIN_OBJECT,
  readHeartModel,
  type HeartModelParts,
} from "./modelGeometry";
import { CAMERA_DISTANCE, CAMERA_TARGET } from "./ViewPresets";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // BUILD_MAP T6.1
const MAX_TRIANGLES = 150_000; // ARCHITECTURE §7
const MM = MODEL_UNITS_PER_MM;

type Point = readonly [number, number, number];

const path = (id: ArteryPath["id"]) => MODEL_ARTERY_PATHS.find((candidate) => candidate.id === id)!;
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const triangles = (geometry: BufferGeometry) => geometry.index!.count / 3;
const vertices = (geometry: BufferGeometry): Point[] => {
  const position = geometry.getAttribute("position");
  return Array.from({ length: position.count }, (_, index) => [
    position.getX(index),
    position.getY(index),
    position.getZ(index),
  ]);
};
const nearest = (point: Point, among: readonly Point[]) => Math.min(...among.map((other) => distance(point, other)));

let fileBytes = 0;
let scene: Object3D;
let parts: HeartModelParts;

beforeAll(async () => {
  const file = await readProjectFile(`public${HEART_MODEL_URL}`);
  fileBytes = file.byteLength;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  // A buffer made here: the loader only recognises a binary file in an ArrayBuffer of its own realm.
  const buffer = new ArrayBuffer(file.byteLength);
  new Uint8Array(buffer).set(file);
  scene = (await loader.parseAsync(buffer, "")).scene;
  parts = readHeartModel(scene);
});

describe("heart model file", () => {
  it("is where the viewer asks for it and within the size budget", () => {
    expect(HEART_MODEL_URL).toBe("/models/heart.glb");
    expect(fileBytes).toBeGreaterThan(100_000);
    expect(fileBytes).toBeLessThan(MAX_FILE_BYTES);
  });

  it("holds exactly the named parts the viewer draws, one per vessel of the registry (TC-3)", () => {
    const names: string[] = [];
    scene.traverse((object) => {
      if ((object as Mesh).isMesh) names.push(object.userData.name as string);
    });

    expect(names.sort()).toEqual(
      [HEART_OBJECT, LEFT_MAIN_OBJECT, BRANCHES_OBJECT, ...VESSELS.map((vessel) => vessel.objectName)].sort(),
    );
    expect(Object.keys(parts.arteries)).toEqual(
      META.targets.filter((target) => target.kind === "vessel").map((target) => target.id),
    );
  });

  it("stays within the triangle budget", () => {
    const all = [parts.heart, parts.leftMain, parts.branches, ...Object.values(parts.arteries)];
    const total = all.reduce((sum, geometry) => sum + triangles(geometry), 0);

    expect(total).toBeLessThan(MAX_TRIANGLES);
    expect(triangles(parts.heart)).toBeGreaterThan(20_000); // not simplified into a blob
    for (const geometry of Object.values(parts.arteries)) expect(triangles(geometry)).toBeGreaterThan(500);
  });

  it("is centred on the point the camera orbits and fits in the starting view", () => {
    const all = [parts.heart, parts.leftMain, parts.branches, ...Object.values(parts.arteries)].flatMap(vertices);
    const low = [0, 1, 2].map((axis) => Math.min(...all.map((point) => point[axis])));
    const high = [0, 1, 2].map((axis) => Math.max(...all.map((point) => point[axis])));

    for (const axis of [0, 1, 2]) {
      expect(low[axis]).toBeCloseTo(MODEL_BOUNDS.min[axis], 2);
      expect(high[axis]).toBeCloseTo(MODEL_BOUNDS.max[axis], 2);
      expect((low[axis] + high[axis]) / 2).toBeCloseTo(CAMERA_TARGET[axis], 2);
    }
    // Half the height the camera sees at its starting distance (35° field of view).
    const halfView = CAMERA_DISTANCE * Math.tan((35 / 2) * (Math.PI / 180));
    const reach = Math.max(...all.map((point) => distance(point, CAMERA_TARGET)));
    expect(reach).toBeLessThan(halfView);
  });

  it("is anatomy at life proportions: a heart about 12 cm tall", () => {
    const heightMm = (MODEL_BOUNDS.max[1] - MODEL_BOUNDS.min[1]) / MM;

    expect(heightMm).toBeGreaterThan(100);
    expect(heightMm).toBeLessThan(140);
  });
});

describe("model arteries ↔ data file (TC-3)", () => {
  it("lists the same vessels as the API and the registry, plus the neutral left main", () => {
    const vesselTargets = META.targets.filter((target) => target.kind === "vessel").map((target) => target.id);

    expect(MODEL_ARTERY_PATHS.filter((entry) => entry.interactive).map((entry) => entry.id)).toEqual(vesselTargets);
    expect(MODEL_ARTERY_PATHS.filter((entry) => !entry.interactive).map((entry) => entry.id)).toEqual(["left_main"]);
  });

  it("builds each coloured artery from the trunk of that artery and nothing else", () => {
    // FMA names, copied on purpose: the object the model colours must be the vessel the model predicts.
    expect(MODEL_SOURCES["artery-lad"]).toEqual([
      { fma: "FMA74912", name: "Trunk of anterior interventricular branch of left coronary artery", files: 3 },
    ]);
    expect(MODEL_SOURCES["artery-lcx"]).toEqual([
      { fma: "FMA74923", name: "Trunk of circumflex branch of left coronary artery", files: 2 },
    ]);
    expect(MODEL_SOURCES["artery-rca"]).toEqual([
      { fma: "FMA3802", name: "Trunk of right coronary artery", files: 3 },
    ]);
    expect(MODEL_SOURCES[LEFT_MAIN_OBJECT]).toEqual([
      { fma: "FMA4685", name: "Stem of left coronary artery", files: 1 },
    ]);
  });

  it("keeps the trunks out of the grey branches and every vessel out of the heart", () => {
    const trunkIds = ["artery-lad", "artery-lcx", "artery-rca", LEFT_MAIN_OBJECT].flatMap((name) =>
      MODEL_SOURCES[name].map((source) => source.fma),
    );
    const branchIds = MODEL_SOURCES[BRANCHES_OBJECT].map((source) => source.fma);
    const heartNames = MODEL_SOURCES[HEART_OBJECT].map((source) => source.name);

    expect(branchIds.filter((fma) => trunkIds.includes(fma))).toEqual([]);
    expect(MODEL_SOURCES[BRANCHES_OBJECT].every((source) => /artery/i.test(source.name))).toBe(true);
    expect(heartNames.filter((name) => /artery|vein|sinus/i.test(name))).toEqual([]);
  });

  it.each(VESSELS.map((vessel) => vessel.id))("the %s mesh lies along its centre line", (id) => {
    const line = path(id).points;
    const mesh = vertices(parts.arteries[id]);
    const radius = path(id).radius;

    // Every part of the mesh is close to the line, and every point of the line is inside the mesh.
    expect(Math.max(...mesh.map((vertex) => nearest(vertex, line)))).toBeLessThan(radius * 4);
    expect(Math.max(...line.map((point) => nearest(point, mesh)))).toBeLessThan(radius * 2.5);
    expect(radius / MM).toBeGreaterThan(1); // millimetres: a coronary trunk, not a hair or a pipe
    expect(radius / MM).toBeLessThan(3);
  });

  it("gives every path usable geometry", () => {
    for (const entry of MODEL_ARTERY_PATHS) {
      expect(entry.points.length).toBeGreaterThan(3);
      expect(entry.points.flat().every(Number.isFinite)).toBe(true);
      expect(entry.labelAnchors.length >= 3).toBe(entry.interactive);
      for (const anchor of entry.labelAnchors) expect(Math.hypot(...anchor.normal)).toBeCloseTo(1, 3);
    }
  });
});

describe("artery courses on the heart model", () => {
  const centre = CAMERA_TARGET;
  const first = (id: VesselId) => path(id).points[0];
  const last = (id: VesselId) => path(id).points[path(id).points.length - 1];

  it("LAD runs down the front of the heart to the apex", () => {
    const lad = path("lad").points;

    expect(first("lad")[1]).toBeGreaterThan(centre[1] + 0.3);
    expect(last("lad")[1]).toBeLessThan(centre[1] - 0.8);
    // In front of the middle of the heart from about a third of its length on, and at its end the frontmost.
    expect(lad.slice(Math.floor(lad.length / 3)).every((point) => point[2] > centre[2])).toBe(true);
    expect(last("lad")[2]).toBeGreaterThan(0.8);
    expect(last("lad")[0]).toBeGreaterThan(centre[0]); // the apex points to the patient's left
  });

  it("LCX goes around the patient's left side to the back and down", () => {
    const lcx = path("lcx").points;

    expect(first("lcx")[0]).toBeGreaterThan(centre[0]);
    expect(Math.min(...lcx.map((point) => point[2]))).toBeLessThan(centre[2] - 0.6);
    expect(last("lcx")[2]).toBeLessThan(centre[2]);
    expect(last("lcx")[1]).toBeLessThan(first("lcx")[1] - 1);
  });

  it("RCA goes around the patient's right side and down to the underside", () => {
    const rca = path("rca").points;

    expect(Math.min(...rca.map((point) => point[0]))).toBeLessThan(centre[0] - 0.6);
    expect(first("rca")[2]).toBeGreaterThan(centre[2]);
    expect(last("rca")[1]).toBeLessThan(first("rca")[1] - 0.8);
    expect(last("rca")[2]).toBeLessThan(first("rca")[2]);
  });

  it("the left main ends where the LAD and the LCX begin", () => {
    const stem = path("left_main").points;
    const end = stem[stem.length - 1];

    expect(distance(end, first("lad"))).toBeLessThan(6 * MM);
    expect(distance(end, first("lcx"))).toBeLessThan(6 * MM);
    expect(distance(end, first("rca"))).toBeGreaterThan(15 * MM);
  });

  it("keeps the right coronary artery apart from the two left ones", () => {
    for (const id of ["lad", "lcx"] as const) {
      const closest = Math.min(...path(id).points.map((point) => nearest(point, path("rca").points)));
      expect(closest).toBeGreaterThan(10 * MM);
    }
  });
});

describe("picking and labels on the heart model", () => {
  let heart: Mesh;
  let shells: Mesh[];

  beforeAll(() => {
    heart = new Mesh(parts.heart, new MeshBasicMaterial());
    heart.name = "heart";
    // The same pointer shells the viewer builds (Artery.tsx): thickened 1.4 times, then 2.6 times.
    shells = VESSELS.map((vessel) => {
      const shell = new Mesh(inflated(parts.arteries[vessel.id], path(vessel.id).radius * (1.4 * 2.6 - 1)), new MeshBasicMaterial());
      shell.name = vessel.id;
      return shell;
    });
  });

  function firstHit(from: Vector3, towards: Vector3, objects: Object3D[]): string | undefined {
    const raycaster = new Raycaster(from, towards.clone().sub(from).normalize());
    return raycaster.intersectObjects(objects, false)[0]?.object.name;
  }

  it.each(VESSELS.map((vessel) => vessel.id))("%s is picked before the heart from where its label can be seen", (id) => {
    for (const anchor of path(id).labelAnchors) {
      const point = new Vector3(...anchor.point);
      const from = point.clone().addScaledVector(new Vector3(...anchor.normal), CAMERA_DISTANCE);
      // Aim at the artery itself: the anchor floats a little outside it.
      const onArtery = new Vector3(...path(id).points.reduce((best, candidate) =>
        distance(candidate, anchor.point) < distance(best, anchor.point) ? candidate : best,
      ));

      expect(firstHit(from, onArtery, [heart, ...shells])).toBe(id);
    }
  });

  it("every label anchor has a clear line of sight along its direction", () => {
    for (const entry of MODEL_ARTERY_PATHS) {
      for (const anchor of entry.labelAnchors) {
        const point = new Vector3(...anchor.point);
        const outside = point.clone().addScaledVector(new Vector3(...anchor.normal), CAMERA_DISTANCE);

        expect(new Raycaster(point, outside.clone().sub(point).normalize()).intersectObject(heart).length).toBe(0);
      }
    }
  });

  it("the heart hides an artery on its far side", () => {
    // The LAD runs down the front: from behind, the heart is in the way.
    const lad = path("lad").points;
    const middle = new Vector3(...lad[Math.floor(lad.length / 2)]);

    expect(firstHit(new Vector3(middle.x, middle.y, 7), middle, [heart, ...shells])).toBe("lad");
    expect(firstHit(new Vector3(middle.x, middle.y, -7), middle, [heart, ...shells])).toBe("heart");
  });

  it("can label the LAD and the RCA from the front and the LCX from the back", () => {
    const facing = (id: VesselId, towards: Point) =>
      Math.max(...path(id).labelAnchors.map(({ normal }) => normal[0] * towards[0] + normal[1] * towards[1] + normal[2] * towards[2]));

    expect(facing("lad", [0, 0, 1])).toBeGreaterThan(0.25);
    expect(facing("rca", [0, 0, 1])).toBeGreaterThan(0.25);
    expect(facing("lcx", [0, 0, -1])).toBeGreaterThan(0.25);
  });
});
