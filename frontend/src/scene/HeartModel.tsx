// The heart model (public/models/heart.glb): the heart, the three coronary arteries as their own
// meshes, and the left main stem and the branches in a neutral colour. A file that cannot be
// loaded, or lacks a named part, is caught by ModelErrorBoundary, which shows the stand-in heart.

import { Bvh, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, type RefObject } from "react";
import type { Mesh } from "three";
import { NO_ESTIMATE_COLOR } from "../config/risk";
import { VESSELS, type VesselId } from "../config/vessels";
import { ModelArtery, NOT_PICKABLE, type ArteryPointer } from "./Artery";
import { MODEL_ARTERY_PATHS } from "./heartModelData";
import {
  BRANCHES_OBJECT,
  disposeHeartModel,
  HEART_OBJECT,
  LEFT_MAIN_OBJECT,
  readHeartModel,
} from "./modelGeometry";
import { HEART_COLOR, heartPointerHandlers } from "./ProxyHeart";

interface HeartModelProps {
  url: string;
  colors: Partial<Record<VesselId, string>>; // risk colour per artery; missing = no estimate
  selectedVessel: VesselId | null;
  hoveredVessel: VesselId | null;
  reducedMotion: boolean;
  heartRef: RefObject<Mesh | null>; // the heart surface, which can hide an artery's label
  onSelectVessel: (id: VesselId) => void;
  onSelectHeart: () => void;
  onHoverVessel: (id: VesselId | null, pointer?: ArteryPointer) => void;
}

// three-mesh-bvh's AVERAGE split strategy. On this model it builds the trees in about 20 ms
// instead of 150 ms with the default (SAH), and rays are as fast (BUILD_MAP T10.1).
const SPLIT_AVERAGE = 1;

const radiusOf = (id: VesselId) => MODEL_ARTERY_PATHS.find((path) => path.id === id)?.radius ?? 0.04;

/** Starts the download as soon as the viewer's code has arrived, before the canvas exists. */
export function preloadHeartModel(url: string) {
  useGLTF.preload(url, false, true);
}

export function HeartModel({
  url,
  colors,
  selectedVessel,
  hoveredVessel,
  reducedMotion,
  heartRef,
  onSelectVessel,
  onSelectHeart,
  onHoverVessel,
}: HeartModelProps) {
  // No Draco: its decoder would be fetched from a CDN (D-007). The meshopt decoder is bundled.
  const { scene } = useGLTF(url, false, true);
  const parts = useMemo(() => readHeartModel(scene), [scene]);
  useEffect(() => () => disposeHeartModel(parts), [parts]);

  return (
    // Bounding-volume trees keep picking and the label checks fast on a mesh of this size. They
    // are built for the heart and the arteries' pointer shells only: nothing else is ever hit.
    <Bvh firstHitOnly strategy={SPLIT_AVERAGE}>
      <mesh ref={heartRef} name={HEART_OBJECT} geometry={parts.heart} {...heartPointerHandlers(onSelectHeart)}>
        <meshStandardMaterial color={HEART_COLOR} roughness={0.85} />
      </mesh>
      {/* Not estimated by any model, so they take the legend's "No estimate" colour. */}
      <mesh name={BRANCHES_OBJECT} geometry={parts.branches} raycast={NOT_PICKABLE}>
        <meshStandardMaterial color={NO_ESTIMATE_COLOR} roughness={0.6} />
      </mesh>
      <mesh name={LEFT_MAIN_OBJECT} geometry={parts.leftMain} raycast={NOT_PICKABLE}>
        <meshStandardMaterial color={NO_ESTIMATE_COLOR} roughness={0.6} />
      </mesh>
      {VESSELS.map((vessel) => (
        <ModelArtery
          key={vessel.id}
          id={vessel.id}
          objectName={vessel.objectName}
          geometry={parts.arteries[vessel.id]}
          radius={radiusOf(vessel.id)}
          color={colors[vessel.id] ?? NO_ESTIMATE_COLOR}
          selected={selectedVessel === vessel.id}
          hovered={hoveredVessel === vessel.id}
          reducedMotion={reducedMotion}
          onSelect={onSelectVessel}
          onHover={onHoverVessel}
        />
      ))}
    </Bvh>
  );
}
