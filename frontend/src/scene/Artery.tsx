// One coronary artery, coloured by risk (BR-5). It always has a dark edge, so it stands out on the
// heart whatever its colour. A wider invisible shell takes the pointer; while the artery is hovered
// or selected it is drawn thicker, with a wider edge in the hover or the selection colour. The
// shape is either the model's own meshes (the trunk with its branches) or, on the stand-in heart,
// a tube along a path.

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, type ReactNode } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3, type BufferGeometry, type MeshStandardMaterial } from "three";
import type { VesselId } from "../config/vessels";
import type { ArteryPath } from "./arteryPaths";
import { ARTERY_OUTLINE_COLOR, HOVERED_OUTLINE_COLOR, SELECTED_OUTLINE_COLOR } from "./colors";
import { thickenedVessel } from "./modelGeometry";
import { useRiskMaterial } from "./useRiskMaterial";

const CLICK_TOLERANCE_PX = 5; // more pointer travel than this is an orbit drag, not a click
const TUBULAR_SEGMENTS = 96;
const RADIAL_SEGMENTS = 12;
// Radius factors, relative to the artery's own radius.
const EMPHASIS = 1.5; // while hovered or selected
const HIT = 2.6; // the invisible shell that takes the pointer
// Widths of the edge around the artery, as shares of the radius it is drawn with.
export const OUTLINE_WIDTH = 0.3; // always
const RIM_WIDTH = 0.5; // while hovered or selected
// The edge is a slightly wider copy of the artery, drawn first and without writing depth; the
// artery is then drawn over it, so the copy shows only around it. An artery lies half sunk in the
// heart, and this way its edge is as wide on the side that is sunk as on the other. (A copy seen
// from its inside, the usual way to draw an outline, would vanish wherever the heart covers it.)
export const EDGE_ORDER = 1;
export const ARTERY_ORDER = 2;
// For meshes that are only drawn. The pointer goes to the shell, and a mesh that cannot be hit
// is also left out when the heart model builds its bounding-volume trees.
export const NOT_PICKABLE = () => null;
// The model's arteries are drawn a little thicker than life, so their colour can be read.
const MODEL_THICKENING = 1.4;
// Branches are thinner than their trunk and are thickened by this share of what the trunk gets,
// so the trunk stays the widest part of its artery.
const BRANCH_SHARE = 0.5;

export interface ArteryPointer {
  clientX: number;
  clientY: number;
}

interface ArteryShapes {
  body: BufferGeometry;
  emphasized: BufferGeometry;
  outline: BufferGeometry; // a little wider than the body: its back faces show as the edge
  rim: BufferGeometry; // the same around the emphasized shape
  hit: BufferGeometry;
}

interface ArteryState {
  color: string;
  selected?: boolean;
  hovered?: boolean;
  reducedMotion?: boolean;
  onSelect?: (id: VesselId) => void;
  onHover?: (id: VesselId | null, pointer?: ArteryPointer) => void;
}

interface ArteryBodyProps extends ArteryState {
  id: VesselId | null; // null: drawn but not interactive (the left main stem)
  objectName: string;
  shapes: ArteryShapes;
  // Extra pieces in the artery's material, e.g. the rounded ends of a tube.
  children?: (material: MeshStandardMaterial, emphasized: boolean) => ReactNode;
}

function ArteryBody({
  id,
  objectName,
  shapes,
  color,
  selected = false,
  hovered = false,
  reducedMotion = false,
  onSelect,
  onHover,
  children,
}: ArteryBodyProps) {
  const material = useRiskMaterial(color, reducedMotion);
  const emphasized = selected || hovered;

  function hover(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    if (id) onHover?.(id, { clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY });
  }

  return (
    <group name={objectName}>
      <mesh geometry={emphasized ? shapes.rim : shapes.outline} renderOrder={EDGE_ORDER} raycast={NOT_PICKABLE}>
        <meshBasicMaterial
          color={selected ? SELECTED_OUTLINE_COLOR : hovered ? HOVERED_OUTLINE_COLOR : ARTERY_OUTLINE_COLOR}
          depthWrite={false}
        />
      </mesh>
      <mesh
        geometry={emphasized ? shapes.emphasized : shapes.body}
        material={material}
        renderOrder={ARTERY_ORDER}
        raycast={NOT_PICKABLE}
      />
      {children?.(material, emphasized)}
      {id && (
        <mesh
          geometry={shapes.hit}
          visible={false}
          onPointerOver={hover}
          onPointerMove={hover}
          onPointerOut={() => onHover?.(null)}
          onClick={(event) => {
            event.stopPropagation();
            if (event.delta <= CLICK_TOLERANCE_PX) onSelect?.(id);
          }}
        />
      )}
    </group>
  );
}

function useDisposal(geometries: BufferGeometry[]) {
  useEffect(() => () => geometries.forEach((geometry) => geometry.dispose()), geometries);
}

interface ArteryProps extends ArteryState {
  path: ArteryPath;
  objectName: string;
}

/** An artery drawn as a tube along a path: the stand-in heart's arteries. */
export function Artery({ path, objectName, ...state }: ArteryProps) {
  const { shapes, ends } = useMemo(() => {
    const points = path.points.map((point) => new Vector3(...point));
    const curve = new CatmullRomCurve3(points, false, "centripetal");
    const tubeOf = (factor: number, tubular = TUBULAR_SEGMENTS, radial = RADIAL_SEGMENTS) =>
      new TubeGeometry(curve, tubular, path.radius * factor, radial, false);
    return {
      shapes: {
        body: tubeOf(1),
        emphasized: tubeOf(EMPHASIS),
        outline: tubeOf(1 + OUTLINE_WIDTH),
        rim: tubeOf(EMPHASIS + RIM_WIDTH),
        hit: tubeOf(HIT, TUBULAR_SEGMENTS / 2, 8),
      },
      ends: [points[0], points[points.length - 1]],
    };
  }, [path]);
  useDisposal([shapes.body, shapes.emphasized, shapes.outline, shapes.rim, shapes.hit]);

  return (
    <ArteryBody id={path.interactive ? (path.id as VesselId) : null} objectName={objectName} shapes={shapes} {...state}>
      {(material, emphasized) =>
        ends.map((end, index) => (
          <mesh key={index} position={end} material={material} renderOrder={ARTERY_ORDER} raycast={NOT_PICKABLE}>
            <sphereGeometry args={[path.radius * (emphasized ? EMPHASIS : 1), RADIAL_SEGMENTS, 8]} />
          </mesh>
        ))
      }
    </ArteryBody>
  );
}

interface ModelArteryProps extends ArteryState {
  id: VesselId;
  objectName: string;
  geometry: BufferGeometry; // the trunk: the artery's own mesh from the heart model
  branches: BufferGeometry; // its branches, drawn and picked as part of the same artery
  radius: number; // the trunk's typical radius, which sets how much thicker the other shapes are
}

/** An artery drawn with its own meshes from the heart model: the trunk and its branches as one. */
export function ModelArtery({ id, objectName, geometry, branches, radius, ...state }: ModelArteryProps) {
  const shapes = useMemo(() => {
    // `factor` thickens the vessel; `edge` then adds the same width to the trunk and the branches.
    const shape = (factor: number, edge = 0) =>
      thickenedVessel(geometry, branches, radius * (MODEL_THICKENING * factor - 1), BRANCH_SHARE, radius * MODEL_THICKENING * edge);
    return {
      body: shape(1),
      emphasized: shape(EMPHASIS),
      outline: shape(1, OUTLINE_WIDTH),
      rim: shape(EMPHASIS, RIM_WIDTH),
      hit: shape(HIT),
    };
  }, [geometry, branches, radius]);
  // The model owns `geometry` and `branches`; the copies are made, and freed, here.
  useDisposal([shapes.body, shapes.emphasized, shapes.outline, shapes.rim, shapes.hit]);

  return <ArteryBody id={id} objectName={objectName} shapes={shapes} {...state} />;
}
