// One coronary artery, coloured by risk (BR-5). A wider invisible shell takes the pointer, and the
// artery is drawn thicker while it is hovered or selected, with a dark rim when it is the selected
// one. The shape is either the model's own artery mesh or, on the stand-in heart, a tube along a path.

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, type ReactNode } from "react";
import { BackSide, CatmullRomCurve3, TubeGeometry, Vector3, type BufferGeometry, type MeshStandardMaterial } from "three";
import type { VesselId } from "../config/vessels";
import type { ArteryPath } from "./arteryPaths";
import { SELECTED_OUTLINE_COLOR } from "./colors";
import { inflated } from "./modelGeometry";
import { useRiskMaterial } from "./useRiskMaterial";

const CLICK_TOLERANCE_PX = 5; // more pointer travel than this is an orbit drag, not a click
const TUBULAR_SEGMENTS = 96;
const RADIAL_SEGMENTS = 12;
// Radius factors, relative to the artery's own radius.
const EMPHASIS = 1.5; // while hovered or selected
const RIM = 2.0; // the selected artery's dark rim
const HIT = 2.6; // the invisible shell that takes the pointer
// For meshes that are only drawn. The pointer goes to the shell, and a mesh that cannot be hit
// is also left out when the heart model builds its bounding-volume trees.
export const NOT_PICKABLE = () => null;
// The model's arteries are drawn a little thicker than life, so their colour can be read.
const MODEL_THICKENING = 1.4;

export interface ArteryPointer {
  clientX: number;
  clientY: number;
}

interface ArteryShapes {
  body: BufferGeometry;
  emphasized: BufferGeometry;
  rim: BufferGeometry;
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
      <mesh geometry={emphasized ? shapes.emphasized : shapes.body} material={material} raycast={NOT_PICKABLE} />
      {children?.(material, emphasized)}
      {selected && (
        <mesh geometry={shapes.rim} raycast={NOT_PICKABLE}>
          <meshBasicMaterial color={SELECTED_OUTLINE_COLOR} side={BackSide} />
        </mesh>
      )}
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
        rim: tubeOf(RIM),
        hit: tubeOf(HIT, TUBULAR_SEGMENTS / 2, 8),
      },
      ends: [points[0], points[points.length - 1]],
    };
  }, [path]);
  useDisposal([shapes.body, shapes.emphasized, shapes.rim, shapes.hit]);

  return (
    <ArteryBody id={path.interactive ? (path.id as VesselId) : null} objectName={objectName} shapes={shapes} {...state}>
      {(material, emphasized) =>
        ends.map((end, index) => (
          <mesh key={index} position={end} material={material} raycast={NOT_PICKABLE}>
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
  geometry: BufferGeometry; // the artery's own mesh from the heart model
  radius: number; // its typical radius, which sets how much thicker the other shapes are
}

/** An artery drawn with its own mesh from the heart model. */
export function ModelArtery({ id, objectName, geometry, radius, ...state }: ModelArteryProps) {
  const shapes = useMemo(
    () => ({
      body: inflated(geometry, radius * (MODEL_THICKENING - 1)),
      emphasized: inflated(geometry, radius * (MODEL_THICKENING * EMPHASIS - 1)),
      rim: inflated(geometry, radius * (MODEL_THICKENING * RIM - 1)),
      hit: inflated(geometry, radius * (MODEL_THICKENING * HIT - 1)),
    }),
    [geometry, radius],
  );
  // The model owns `geometry`; the copies are made, and freed, here.
  useDisposal([shapes.body, shapes.emphasized, shapes.rim, shapes.hit]);

  return <ArteryBody id={id} objectName={objectName} shapes={shapes} {...state} />;
}
