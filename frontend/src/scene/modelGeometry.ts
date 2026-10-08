// Geometry of the heart model (public/models/heart.glb): plain functions on three.js objects, no
// rendering, so they can be tested without WebGL.

import { BufferAttribute, BufferGeometry, Matrix3, Mesh, Vector3, type Object3D } from "three";
import { VESSELS, type VesselId } from "../config/vessels";

// Object names in the model file. The three arteries are named by the vessel registry (TC-3).
export const HEART_OBJECT = "heart";
export const LEFT_MAIN_OBJECT = "artery-left-main";
export const BRANCHES_OBJECT = "artery-branches";

export interface HeartModelParts {
  heart: BufferGeometry;
  leftMain: BufferGeometry; // neutral: the stem before the LAD and the LCX
  branches: BufferGeometry; // neutral: the models estimate the three vessels, not their branches
  arteries: Record<VesselId, BufferGeometry>;
}

/**
 * A mesh's geometry in the model's space as plain floats. The compressed file stores positions
 * as scaled integers with the scale on the mesh; baked, they can be offset and raycast directly.
 */
export function bakedGeometry(mesh: Mesh): BufferGeometry {
  mesh.updateWorldMatrix(true, false);
  const position = mesh.geometry.getAttribute("position");
  const normal = mesh.geometry.getAttribute("normal");
  const normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld);
  const positions = new Float32Array(position.count * 3);
  const normals = new Float32Array(position.count * 3);
  const vector = new Vector3();
  for (let index = 0; index < position.count; index += 1) {
    vector.fromBufferAttribute(position, index).applyMatrix4(mesh.matrixWorld).toArray(positions, index * 3);
    vector.fromBufferAttribute(normal, index).applyMatrix3(normalMatrix).normalize().toArray(normals, index * 3);
  }
  const baked = new BufferGeometry();
  baked.setAttribute("position", new BufferAttribute(positions, 3));
  baked.setAttribute("normal", new BufferAttribute(normals, 3));
  if (mesh.geometry.index) baked.setIndex(mesh.geometry.index.clone());
  return baked;
}

/** The same surface moved outwards along its normals: a thicker copy of a vessel. */
export function inflated(geometry: BufferGeometry, distance: number): BufferGeometry {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const positions = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index += 1) {
    positions[index * 3] = position.getX(index) + normal.getX(index) * distance;
    positions[index * 3 + 1] = position.getY(index) + normal.getY(index) * distance;
    positions[index * 3 + 2] = position.getZ(index) + normal.getZ(index) * distance;
  }
  const thicker = new BufferGeometry();
  thicker.setAttribute("position", new BufferAttribute(positions, 3));
  thicker.setAttribute("normal", normal);
  thicker.setIndex(geometry.index);
  return thicker;
}

function part(root: Object3D, name: string): BufferGeometry {
  let found: Mesh | undefined;
  root.traverse((object) => {
    // The loader keeps a node's name from the file in userData and may alter `name` to keep it unique.
    const named = object.userData.name === name || object.name === name;
    if (!found && named && (object as Mesh).isMesh) found = object as Mesh;
  });
  if (!found) throw new Error(`The heart model has no "${name}" mesh.`);
  return bakedGeometry(found);
}

/**
 * The named parts of a loaded heart model. Throws when one is missing, so a file that does not
 * match the vessel registry is refused and the stand-in heart is shown instead (F11).
 */
export function readHeartModel(root: Object3D): HeartModelParts {
  root.updateWorldMatrix(true, true);
  return {
    heart: part(root, HEART_OBJECT),
    leftMain: part(root, LEFT_MAIN_OBJECT),
    branches: part(root, BRANCHES_OBJECT),
    arteries: Object.fromEntries(VESSELS.map((vessel) => [vessel.id, part(root, vessel.objectName)])) as Record<
      VesselId,
      BufferGeometry
    >,
  };
}

export function disposeHeartModel(parts: HeartModelParts): void {
  [parts.heart, parts.leftMain, parts.branches, ...Object.values(parts.arteries)].forEach((geometry) =>
    geometry.dispose(),
  );
}
