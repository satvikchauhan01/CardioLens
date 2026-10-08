// One material per artery whose colour follows the artery's risk colour (BR-5), with a short
// transition between colours and no per-frame allocations.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, MeshStandardMaterial } from "three";

export const COLOR_TRANSITION_SECONDS = 0.4;

export function useRiskMaterial(color: string, reducedMotion: boolean): MeshStandardMaterial {
  const invalidate = useThree((state) => state.invalidate);

  // Created once with the first colour; later colours are tweened below.
  const material = useMemo(
    () => new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, roughness: 0.45 }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  // Two preallocated colours and a start time.
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

  return material;
}
