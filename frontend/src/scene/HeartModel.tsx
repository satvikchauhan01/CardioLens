// The heart model (public/models/heart.glb): the heart in its own colours, the three coronary
// arteries with their branches as their own meshes, and the left main stem in a neutral colour.
// A file that cannot be loaded, or lacks a named part, is caught by ModelErrorBoundary, which
// shows the stand-in heart.

import { Bvh, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, type RefObject } from "react";
import type { Mesh } from "three";
import { NO_ESTIMATE_COLOR } from "../config/risk";
import { VESSELS, type VesselId } from "../config/vessels";
import { ARTERY_ORDER, EDGE_ORDER, ModelArtery, NOT_PICKABLE, OUTLINE_WIDTH, type ArteryPointer } from "./Artery";
import { ARTERY_OUTLINE_COLOR } from "./colors";
import { MODEL_ARTERY_PATHS } from "./heartModelData";
import { disposeHeartModel, HEART_OBJECT, inflated, LEFT_MAIN_OBJECT, readHeartModel } from "./modelGeometry";
import { heartPointerHandlers } from "./ProxyHeart";

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

const radiusOf = (id: VesselId | "left_main") => MODEL_ARTERY_PATHS.find((path) => path.id === id)?.radius ?? 0.04;
// A wet surface catches the light a little; the heart is neither matt nor shiny.
const HEART_ROUGHNESS = 0.62;

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
  // The stem gets the same dark edge as the arteries it leads to.
  const leftMainEdge = useMemo(() => inflated(parts.leftMain, radiusOf("left_main") * OUTLINE_WIDTH), [parts]);
  useEffect(() => () => leftMainEdge.dispose(), [leftMainEdge]);

  return (
    // Bounding-volume trees keep picking and the label checks fast on a mesh of this size. They
    // are built for the heart and the arteries' pointer shells only: nothing else is ever hit.
    <Bvh firstHitOnly strategy={SPLIT_AVERAGE}>
      <mesh ref={heartRef} name={HEART_OBJECT} geometry={parts.heart} {...heartPointerHandlers(onSelectHeart)}>
        {/* Each region of the heart carries its own colour in the geometry (modelGeometry.ts). */}
        <meshStandardMaterial vertexColors roughness={HEART_ROUGHNESS} />
      </mesh>
      {/* The LAD and the LCX share this stem, so it belongs to no estimate: the legend's "No estimate" colour. */}
      <mesh geometry={leftMainEdge} renderOrder={EDGE_ORDER} raycast={NOT_PICKABLE}>
        <meshBasicMaterial color={ARTERY_OUTLINE_COLOR} depthWrite={false} />
      </mesh>
      <mesh name={LEFT_MAIN_OBJECT} geometry={parts.leftMain} renderOrder={ARTERY_ORDER} raycast={NOT_PICKABLE}>
        <meshStandardMaterial color={NO_ESTIMATE_COLOR} roughness={0.6} />
      </mesh>
      {VESSELS.map((vessel) => (
        <ModelArtery
          key={vessel.id}
          id={vessel.id}
          objectName={vessel.objectName}
          geometry={parts.arteries[vessel.id]}
          branches={parts.branches[vessel.id]}
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
