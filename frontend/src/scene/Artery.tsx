// One coronary artery: a tube along its path, coloured by risk (BR-5). A wider invisible shell
// takes the pointer, and the tube is drawn thicker while it is hovered or selected, with a dark
// rim when it is the selected one.

import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BackSide, CatmullRomCurve3, Color, MeshStandardMaterial, TubeGeometry, Vector3 } from "three";
import type { VesselId } from "../config/vessels";
import type { ArteryPath } from "./arteryPaths";

export const COLOR_TRANSITION_SECONDS = 0.4;
const CLICK_TOLERANCE_PX = 5; // more pointer travel than this is an orbit drag, not a click
const TUBULAR_SEGMENTS = 96;
const RADIAL_SEGMENTS = 12;
const EMPHASIS = 1.5; // radius factor while hovered or selected
const RIM = 2.0; // radius factor of the selected artery's dark rim
const RIM_COLOR = "#0f172a";

export interface ArteryPointer {
  clientX: number;
  clientY: number;
}

interface ArteryProps {
  path: ArteryPath;
  objectName: string;
  color: string;
  selected?: boolean;
  hovered?: boolean;
  reducedMotion?: boolean;
  onSelect?: (id: VesselId) => void;
  onHover?: (id: VesselId | null, pointer?: ArteryPointer) => void;
}

export function Artery({
  path,
  objectName,
  color,
  selected = false,
  hovered = false,
  reducedMotion = false,
  onSelect,
  onHover,
}: ArteryProps) {
  const invalidate = useThree((state) => state.invalidate);

  const { tube, thickTube, rim, hitShell, ends } = useMemo(() => {
    const points = path.points.map((point) => new Vector3(...point));
    const curve = new CatmullRomCurve3(points, false, "centripetal");
    const tubeOf = (factor: number, tubular = TUBULAR_SEGMENTS, radial = RADIAL_SEGMENTS) =>
      new TubeGeometry(curve, tubular, path.radius * factor, radial, false);
    return {
      tube: tubeOf(1),
      thickTube: tubeOf(EMPHASIS),
      rim: tubeOf(RIM),
      hitShell: tubeOf(2.6, TUBULAR_SEGMENTS / 2, 8),
      ends: [points[0], points[points.length - 1]],
    };
  }, [path]);

  // One material per artery, created once with the first colour; later colours are tweened below.
  const material = useMemo(
    () => new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, roughness: 0.45 }),
    [],
  );

  useEffect(
    () => () => {
      tube.dispose();
      thickTube.dispose();
      rim.dispose();
      hitShell.dispose();
    },
    [tube, thickTube, rim, hitShell],
  );
  useEffect(() => () => material.dispose(), [material]);

  // Colour tween without per-frame allocations: two preallocated colours and a start time.
  const from = useRef(new Color(color));
  const to = useRef(new Color(color));
  const startedAt = useRef<number | null>(null);
  const animating = useRef(false);

  useEffect(() => {
    from.current.copy(material.color);
    to.current.set(color);
    if (reducedMotion) {
      material.color.copy(to.current);
      material.emissive.copy(to.current);
      animating.current = false;
    } else {
      startedAt.current = null;
      animating.current = true;
    }
    invalidate();
  }, [color, reducedMotion, material, invalidate]);

  useFrame(({ clock }) => {
    if (!animating.current) return;
    startedAt.current ??= clock.elapsedTime;
    const progress = Math.min(1, (clock.elapsedTime - startedAt.current) / COLOR_TRANSITION_SECONDS);
    material.color.lerpColors(from.current, to.current, progress);
    material.emissive.copy(material.color);
    if (progress >= 1) animating.current = false;
    else invalidate();
  });

  const emphasized = selected || hovered;
  const radius = path.radius * (emphasized ? EMPHASIS : 1);
  const id = path.id as VesselId;

  function hover(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    onHover?.(id, { clientX: event.nativeEvent.clientX, clientY: event.nativeEvent.clientY });
  }

  return (
    <group name={objectName}>
      <mesh geometry={emphasized ? thickTube : tube} material={material} />
      {ends.map((end, index) => (
        <mesh key={index} position={end} material={material}>
          <sphereGeometry args={[radius, RADIAL_SEGMENTS, 8]} />
        </mesh>
      ))}
      {selected && (
        <mesh geometry={rim}>
          <meshBasicMaterial color={RIM_COLOR} side={BackSide} />
        </mesh>
      )}
      {path.interactive && (
        <mesh
          geometry={hitShell}
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
