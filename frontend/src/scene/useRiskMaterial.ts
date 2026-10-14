// One material per artery whose colour follows the artery's risk colour (BR-5), with a short
// transition between colours and no per-frame allocations. A change of colour, and being
// selected, also make the artery light up once for a moment; afterwards it is back at exactly
// its risk colour, so the colour on the heart always equals the colour in the legend.

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, MeshStandardMaterial } from "three";

const COLOR_TRANSITION_SECONDS = 0.4;
const GLOW = 0.3; // the artery's own colour, emitted a little, so it reads in the shade too
const PULSE_GLOW = 0.55; // added at the height of a pulse
const PULSE_SECONDS = 0.6;

export function useRiskMaterial(color: string, reducedMotion: boolean, highlighted = false): MeshStandardMaterial {
  const invalidate = useThree((state) => state.invalidate);

  // Created once with the first colour; later colours are tweened below.
  const material = useMemo(
    () => new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: GLOW, roughness: 0.45 }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  // Two preallocated colours and two start times.
  const from = useRef(new Color(color));
  const to = useRef(new Color(color));
  const startedAt = useRef<number | null>(null);
  const animating = useRef(false);
  const pulseStartedAt = useRef<number | null>(null);
  const pulsing = useRef(false);

  useEffect(() => {
    from.current.copy(material.color);
    to.current.set(color);
    const changed = !from.current.equals(to.current);
    if (reducedMotion || !changed) {
      material.color.copy(to.current);
      material.emissive.copy(to.current);
      animating.current = false;
    } else {
      startedAt.current = null;
      animating.current = true;
      pulseStartedAt.current = null;
      pulsing.current = true;
    }
    invalidate();
  }, [color, reducedMotion, material, invalidate]);

  useEffect(() => {
    if (!highlighted || reducedMotion) return;
    pulseStartedAt.current = null;
    pulsing.current = true;
    invalidate();
  }, [highlighted, reducedMotion, invalidate]);

  useFrame(({ clock }) => {
    if (animating.current) {
      startedAt.current ??= clock.elapsedTime;
      const progress = Math.min(1, (clock.elapsedTime - startedAt.current) / COLOR_TRANSITION_SECONDS);
      material.color.lerpColors(from.current, to.current, progress);
      material.emissive.copy(material.color);
      if (progress >= 1) animating.current = false;
    }
    if (pulsing.current) {
      pulseStartedAt.current ??= clock.elapsedTime;
      const progress = Math.min(1, (clock.elapsedTime - pulseStartedAt.current) / PULSE_SECONDS);
      material.emissiveIntensity = GLOW + PULSE_GLOW * Math.sin(Math.PI * progress);
      if (progress >= 1) {
        pulsing.current = false;
        material.emissiveIntensity = GLOW;
      }
    }
    if (animating.current || pulsing.current) invalidate();
  });

  return material;
}
