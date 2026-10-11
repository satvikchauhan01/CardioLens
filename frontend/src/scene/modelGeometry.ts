// Geometry of the heart model (public/models/heart.glb): plain functions on three.js objects, no
// rendering, so they can be tested without WebGL.

import { BufferAttribute, BufferGeometry, Color, Matrix3, Mesh, Vector3, type Object3D } from "three";
import { VESSELS, type VesselId } from "../config/vessels";
import { HEART_REGION_COLORS } from "./colors";
import { MODEL_HEART_REGIONS } from "./heartModelData";

// Object names in the model file. The arteries and their branches are named by the vessel
// registry (TC-3).
export const HEART_OBJECT = "heart";
export const LEFT_MAIN_OBJECT = "artery-left-main";

export interface HeartModelParts {
  heart: BufferGeometry;
  leftMain: BufferGeometry; // neutral: the stem the LAD and the LCX share
  arteries: Record<VesselId, BufferGeometry>; // the trunk of each vessel
  branches: Record<VesselId, BufferGeometry>; // each vessel's branches, coloured like its trunk
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

/** Several surfaces as one geometry (positions, normals, triangles), so they are drawn and hit as one. */
export function merged(geometries: readonly BufferGeometry[]): BufferGeometry {
  const vertexCount = geometries.reduce((sum, geometry) => sum + geometry.getAttribute("position").count, 0);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const indices: number[] = [];
  let offset = 0;
  for (const geometry of geometries) {
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    for (let index = 0; index < position.count; index += 1) {
      const at = (offset + index) * 3;
      positions[at] = position.getX(index);
      positions[at + 1] = position.getY(index);
      positions[at + 2] = position.getZ(index);
      normals[at] = normal.getX(index);
      normals[at + 1] = normal.getY(index);
      normals[at + 2] = normal.getZ(index);
    }
    const triangles = geometry.index;
    if (!triangles) throw new Error("Only indexed geometries can be merged.");
    for (let corner = 0; corner < triangles.count; corner += 1) indices.push(triangles.getX(corner) + offset);
    offset += position.count;
  }
  const whole = new BufferGeometry();
  whole.setAttribute("position", new BufferAttribute(positions, 3));
  whole.setAttribute("normal", new BufferAttribute(normals, 3));
  whole.setIndex(indices);
  return whole;
}

/**
 * A vessel as one surface, thicker than in the model: the trunk moved outwards by `distance` and
 * its branches, which are thinner, by `branchShare` of that. `outline` is added to both alike:
 * the width of an edge drawn around the vessel, the same on the trunk and on its branches.
 */
export function thickenedVessel(
  trunk: BufferGeometry,
  branches: BufferGeometry,
  distance: number,
  branchShare: number,
  outline = 0,
): BufferGeometry {
  return merged([inflated(trunk, distance + outline), inflated(branches, distance * branchShare + outline)]);
}

/**
 * Colours for a geometry whose vertices are marked with their region. The model file marks a
 * region as a pure colour (red, green, blue: the first, second and third region); the strongest
 * channel tells which, so the mark survives the file's compression. A file without marks gets
 * the first colour throughout.
 */
export function regionColors(marks: BufferAttribute | undefined, count: number, palette: readonly string[]): BufferAttribute {
  // Vertex colours are read as linear values; Color converts each hex colour once.
  const shades = palette.map((hex) => new Color(hex));
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    let region = 0;
    if (marks) {
      const channels = [marks.getX(index), marks.getY(index), marks.getZ(index)];
      region = channels.indexOf(Math.max(...channels));
    }
    shades[Math.min(region, shades.length - 1)].toArray(colors, index * 3);
  }
  return new BufferAttribute(colors, 3);
}

function mesh(root: Object3D, name: string): Mesh {
  let found: Mesh | undefined;
  root.traverse((object) => {
    // The loader keeps a node's name from the file in userData and may alter `name` to keep it unique.
    const named = object.userData.name === name || object.name === name;
    if (!found && named && (object as Mesh).isMesh) found = object as Mesh;
  });
  if (!found) throw new Error(`The heart model has no "${name}" mesh.`);
  return found;
}

function part(root: Object3D, name: string): BufferGeometry {
  return bakedGeometry(mesh(root, name));
}

/** The heart surface, each region in its own colour. */
function heartPart(root: Object3D): BufferGeometry {
  const source = mesh(root, HEART_OBJECT);
  const heart = bakedGeometry(source);
  const marks = source.geometry.getAttribute("color") as BufferAttribute | undefined;
  const palette = MODEL_HEART_REGIONS.map((region) => HEART_REGION_COLORS[region]);
  heart.setAttribute("color", regionColors(marks, heart.getAttribute("position").count, palette));
  return heart;
}

/**
 * The named parts of a loaded heart model. Throws when one is missing, so a file that does not
 * match the vessel registry is refused and the stand-in heart is shown instead (F11).
 */
export function readHeartModel(root: Object3D): HeartModelParts {
  root.updateWorldMatrix(true, true);
  const perVessel = (name: (vessel: (typeof VESSELS)[number]) => string) =>
    Object.fromEntries(VESSELS.map((vessel) => [vessel.id, part(root, name(vessel))])) as Record<VesselId, BufferGeometry>;
  return {
    heart: heartPart(root),
    leftMain: part(root, LEFT_MAIN_OBJECT),
    arteries: perVessel((vessel) => vessel.objectName),
    branches: perVessel((vessel) => vessel.branchesObjectName),
  };
}

export function disposeHeartModel(parts: HeartModelParts): void {
  [parts.heart, parts.leftMain, ...Object.values(parts.arteries), ...Object.values(parts.branches)].forEach(
    (geometry) => geometry.dispose(),
  );
}
