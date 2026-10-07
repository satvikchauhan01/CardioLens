// The stand-in heart: a stylised body with three great-vessel stubs, in neutral tones so that
// the arteries are the only coloured things in the scene. Also the fallback when a mesh fails.

import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, DoubleSide, TubeGeometry, Vector3 } from "three";
import { buildHeartMesh, GREAT_VESSELS } from "./heartShape";

export const HEART_COLOR = "#e9e4df";
const GREAT_VESSEL_COLOR = "#dad4ce";
const CLICK_TOLERANCE_PX = 5;

/** Handlers for any heart mesh: it hides what is behind it, and a click on it selects CAD. */
export function heartPointerHandlers(onSelectHeart: () => void) {
  const block = (event: ThreeEvent<PointerEvent>) => event.stopPropagation();
  return {
    onPointerOver: block,
    onPointerMove: block,
    onClick: (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      if (event.delta <= CLICK_TOLERANCE_PX) onSelectHeart();
    },
  };
}

export function ProxyHeart({ onSelectHeart }: { onSelectHeart: () => void }) {
  const body = useMemo(() => {
    const mesh = buildHeartMesh();
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(mesh.positions, 3));
    geometry.setAttribute("normal", new BufferAttribute(mesh.normals, 3));
    geometry.setIndex(mesh.indices);
    return geometry;
  }, []);

  const vessels = useMemo(
    () =>
      GREAT_VESSELS.map((vessel) => {
        const curve = new CatmullRomCurve3(vessel.points.map((point) => new Vector3(...point)));
        return { id: vessel.id, geometry: new TubeGeometry(curve, 24, vessel.radius, 20, false) };
      }),
    [],
  );

  useEffect(
    () => () => {
      body.dispose();
      vessels.forEach((vessel) => vessel.geometry.dispose());
    },
    [body, vessels],
  );

  return (
    <group name="heart" {...heartPointerHandlers(onSelectHeart)}>
      <mesh geometry={body}>
        <meshStandardMaterial color={HEART_COLOR} roughness={0.85} />
      </mesh>
      {vessels.map((vessel) => (
        <mesh key={vessel.id} geometry={vessel.geometry}>
          {/* Open-ended tubes: both faces are drawn so the cut end does not look hollow. */}
          <meshStandardMaterial color={GREAT_VESSEL_COLOR} roughness={0.85} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
