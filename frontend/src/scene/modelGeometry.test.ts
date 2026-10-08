import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { VESSELS } from "../config/vessels";
import {
  bakedGeometry,
  BRANCHES_OBJECT,
  HEART_OBJECT,
  inflated,
  LEFT_MAIN_OBJECT,
  readHeartModel,
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

const ALL_NAMES = [HEART_OBJECT, LEFT_MAIN_OBJECT, BRANCHES_OBJECT, ...VESSELS.map((vessel) => vessel.objectName)];

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

  it("finds every named part of a loaded model", () => {
    const root = new Group();
    ALL_NAMES.forEach((name, index) => root.add(named(name, index % 2 === 0)));

    const parts = readHeartModel(root);

    expect(Object.keys(parts.arteries)).toEqual(VESSELS.map((vessel) => vessel.id));
    for (const geometry of [parts.heart, parts.leftMain, parts.branches, ...Object.values(parts.arteries)]) {
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
