import { BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { VESSELS } from "../config/vessels";
import { HEART_REGION_COLORS } from "./colors";
import {
  bakedGeometry,
  HEART_OBJECT,
  inflated,
  LEFT_MAIN_OBJECT,
  merged,
  readHeartModel,
  regionColors,
  thickenedVessel,
} from "./modelGeometry";

/** One triangle in the z = 0 plane, facing +z. */
function triangle(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  geometry.setAttribute("normal", new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  geometry.setIndex([0, 1, 2]);
  return geometry;
}

const positions = (geometry: BufferGeometry) => Array.from(geometry.getAttribute("position").array);
const normals = (geometry: BufferGeometry) => Array.from(geometry.getAttribute("normal").array);

function named(name: string, inUserData = false): Mesh {
  const mesh = new Mesh(triangle(), new MeshBasicMaterial());
  if (inUserData) {
    // What the glTF loader does when it has to change a name to keep it unique.
    mesh.name = `${name}_1`;
    mesh.userData.name = name;
  } else {
    mesh.name = name;
  }
  return mesh;
}

const ALL_NAMES = [
  HEART_OBJECT,
  LEFT_MAIN_OBJECT,
  ...VESSELS.flatMap((vessel) => [vessel.objectName, vessel.branchesObjectName]),
];

describe("heart model geometry", () => {
  it("bakes a mesh's own and its parents' transforms into plain positions and normals", () => {
    const mesh = new Mesh(triangle(), new MeshBasicMaterial());
    mesh.scale.setScalar(2);
    mesh.position.set(0, 0, 5);
    const parent = new Group();
    parent.position.set(10, 0, 0);
    parent.add(mesh);

    const baked = bakedGeometry(mesh);

    expect(positions(baked)).toEqual([10, 0, 5, 12, 0, 5, 10, 2, 5]);
    expect(normals(baked)).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    expect(Array.from(baked.index!.array)).toEqual([0, 1, 2]);
    expect(baked.getAttribute("position").array).toBeInstanceOf(Float32Array);
  });

  it("reads positions and normals stored as scaled integers, as the compressed file does", () => {
    const geometry = new BufferGeometry();
    // int16, normalised: 32767 stands for 1.
    geometry.setAttribute("position", new BufferAttribute(new Int16Array([0, 0, 0, 32767, 0, 0, 0, 32767, 0]), 3, true));
    geometry.setAttribute("normal", new BufferAttribute(new Int16Array([0, 0, 32767, 0, 0, 32767, 0, 0, 32767]), 3, true));
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    mesh.scale.setScalar(3); // the file keeps the real size on the mesh

    const baked = bakedGeometry(mesh);

    expect(positions(baked)).toEqual([0, 0, 0, 3, 0, 0, 0, 3, 0]);
    expect(normals(baked)).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  });

  it("makes a thicker copy by moving every vertex along its normal", () => {
    const thin = triangle();
    const thick = inflated(thin, 0.25);

    expect(positions(thick)).toEqual([0, 0, 0.25, 1, 0, 0.25, 0, 1, 0.25]);
    expect(positions(thin)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(thick.index).toBe(thin.index);
  });

  it("joins several surfaces into one, keeping every triangle", () => {
    const second = triangle();
    second.translate(0, 0, 2);

    const whole = merged([triangle(), second]);

    expect(positions(whole)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2, 1, 0, 2, 0, 1, 2]);
    expect(normals(whole)).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
    expect(Array.from(whole.index!.array)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("thickens a vessel's branches by a share of what its trunk gets", () => {
    const branches = triangle();
    branches.translate(5, 0, 0);

    const vessel = thickenedVessel(triangle(), branches, 0.4, 0.5);

    // The trunk moves 0.4 along its normal (+z), the branches 0.2.
    expect(positions(vessel)).toEqual([0, 0, 0.4, 1, 0, 0.4, 0, 1, 0.4, 5, 0, 0.2, 6, 0, 0.2, 5, 1, 0.2].map(Math.fround));
    expect(vessel.index!.count).toBe(6);
  });

  it("adds the width of an edge to the trunk and to the branches alike", () => {
    const branches = triangle();
    branches.translate(5, 0, 0);

    const edge = thickenedVessel(triangle(), branches, 0.4, 0.5, 0.1);

    // Trunk 0.4 + 0.1, branches 0.2 + 0.1: the edge around both is 0.1 wide.
    expect(positions(edge)).toEqual([0, 0, 0.5, 1, 0, 0.5, 0, 1, 0.5, 5, 0, 0.3, 6, 0, 0.3, 5, 1, 0.3].map(Math.fround));
  });

  it("gives each vertex the colour of the region it is marked with", () => {
    const palette = ["#ff0000", "#00ff00", "#0000ff"];
    // Marks as the compressed file holds them: bytes that stand for 0 to 1, not always exact.
    const marks = new BufferAttribute(new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 250, 6, 3, 2, 240, 9]), 3, true);

    const colors = Array.from(regionColors(marks, 5, palette).array);

    expect(colors).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0]);
  });

  it("stores the colours as the linear values that vertex colours are read as", () => {
    const [red, green, blue] = Array.from(regionColors(undefined, 1, ["#e09d97"]).array);
    const expected = new Color("#e09d97");

    expect([red, green, blue]).toEqual([expected.r, expected.g, expected.b].map(Math.fround));
    expect(red).toBeLessThan(0xe0 / 255); // linear, not the sRGB byte
  });

  it("uses the first colour throughout for a model without region marks", () => {
    const colors = Array.from(regionColors(undefined, 2, ["#ffffff", "#000000"]).array);

    expect(colors).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("colours the heart of a loaded model, the ventricles' colour where nothing is marked", () => {
    const root = new Group();
    ALL_NAMES.forEach((name) => root.add(named(name)));

    const heart = readHeartModel(root).heart;
    const muscle = new Color(HEART_REGION_COLORS.ventricle);

    expect(heart.getAttribute("color").count).toBe(3);
    expect(heart.getAttribute("color").getX(0)).toBeCloseTo(muscle.r, 6);
    expect(readHeartModel(root).arteries.lad.getAttribute("color")).toBeUndefined();
  });

  it("finds every named part of a loaded model", () => {
    const root = new Group();
    ALL_NAMES.forEach((name, index) => root.add(named(name, index % 2 === 0)));

    const parts = readHeartModel(root);

    expect(Object.keys(parts.arteries)).toEqual(VESSELS.map((vessel) => vessel.id));
    expect(Object.keys(parts.branches)).toEqual(VESSELS.map((vessel) => vessel.id));
    for (const geometry of [parts.heart, parts.leftMain, ...Object.values(parts.arteries), ...Object.values(parts.branches)]) {
      expect(geometry.getAttribute("position").count).toBe(3);
    }
  });

  it.each(ALL_NAMES)("refuses a model without %s", (missing) => {
    const root = new Group();
    ALL_NAMES.filter((name) => name !== missing).forEach((name) => root.add(named(name)));

    expect(() => readHeartModel(root)).toThrow(`The heart model has no "${missing}" mesh.`);
  });

  it("does not take a group for a mesh of the same name", () => {
    const root = new Group();
    root.name = HEART_OBJECT; // the file's scene may carry the same name as a part
    ALL_NAMES.filter((name) => name !== HEART_OBJECT).forEach((name) => root.add(named(name)));

    expect(() => readHeartModel(root)).toThrow(`The heart model has no "${HEART_OBJECT}" mesh.`);
  });
});
