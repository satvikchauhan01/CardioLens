// The WebGL scene (F5). Loaded lazily, so three.js stays out of the first bundle.
// Performance choices (ARCHITECTURE §7): frames are drawn on demand, pixel ratio is capped at 1.5,
// three lights, no shadows, no environment map, nothing allocated per frame.

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, type RefObject } from "react";
import { MathUtils, Spherical, Vector3 } from "three";
import { NO_ESTIMATE_COLOR } from "../config/risk";
import { HEART_MODEL_URL, VESSELS, type VesselId } from "../config/vessels";
import { Artery, type ArteryPointer } from "./Artery";
import { ARTERY_PATHS, arteryPath } from "./arteryPaths";
import { HeartModel } from "./HeartModel";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { ProxyHeart } from "./ProxyHeart";
import {
  CAMERA_DISTANCE,
  CAMERA_TARGET,
  VIEW_TRANSITION_SECONDS,
  VIEWS,
  type ViewId,
  type ViewRequest,
} from "./ViewPresets";

const LEFT_MAIN_COLOR = "#64748b";
const TARGET = new Vector3(...CAMERA_TARGET);

function viewSpherical(view: ViewId, out = new Spherical()): Spherical {
  const { azimuth, polar } = VIEWS[view];
  return out.set(CAMERA_DISTANCE, MathUtils.degToRad(polar), MathUtils.degToRad(azimuth));
}

const START_POSITION = new Vector3().setFromSpherical(viewSpherical("reset")).add(TARGET);

/** Moves the camera to a requested view, along the shorter way around the heart. */
function CameraRig({ request, reducedMotion }: { request: ViewRequest | null; reducedMotion: boolean }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as { update: () => void } | null;
  const invalidate = useThree((state) => state.invalidate);
  const from = useRef(new Spherical());
  const to = useRef(new Spherical());
  const current = useRef(new Spherical());
  const offset = useRef(new Vector3());
  const startedAt = useRef<number | null>(null);
  const moving = useRef(false);

  useEffect(() => {
    if (!request) return;
    from.current.setFromVector3(offset.current.copy(camera.position).sub(TARGET));
    viewSpherical(request.view, to.current);
    const turn = MathUtils.euclideanModulo(to.current.theta - from.current.theta + Math.PI, 2 * Math.PI) - Math.PI;
    to.current.theta = from.current.theta + turn;
    startedAt.current = null;
    moving.current = true;
    invalidate();
  }, [request, camera, invalidate]);

  useFrame(({ clock }) => {
    if (!moving.current) return;
    startedAt.current ??= clock.elapsedTime;
    const elapsed = (clock.elapsedTime - startedAt.current) / VIEW_TRANSITION_SECONDS;
    const progress = reducedMotion ? 1 : MathUtils.smoothstep(Math.min(1, elapsed), 0, 1);
    current.current.set(
      MathUtils.lerp(from.current.radius, to.current.radius, progress),
      MathUtils.lerp(from.current.phi, to.current.phi, progress),
      MathUtils.lerp(from.current.theta, to.current.theta, progress),
    );
    camera.position.setFromSpherical(current.current).add(TARGET);
    camera.lookAt(TARGET);
    controls?.update();
    if (progress >= 1) moving.current = false;
    else invalidate();
  });

  return null;
}

export type LabelElements = Partial<Record<VesselId, HTMLElement | null>>;

const FACING_ENOUGH = 0.25; // how squarely an anchor must face the camera to carry the label

const LABELS = ARTERY_PATHS.filter((path) => path.interactive).map((path) => ({
  id: path.id as VesselId,
  anchors: path.labelAnchors.map((anchor) => ({
    point: new Vector3(...anchor.point),
    normal: new Vector3(...anchor.normal),
  })),
}));

/**
 * Keeps the page's label elements over their arteries. The labels are ordinary DOM elements owned
 * by ViewerPanel; this only moves them. Each label sits on the part of its artery that faces the
 * camera and hides when none does.
 */
function LabelProjector({ elements }: { elements: RefObject<LabelElements> }) {
  const projected = useRef(new Vector3());
  const toCamera = useRef(new Vector3());
  // The anchor each label uses; it is kept until it turns away, so the label does not flicker.
  const inUse = useRef(LABELS.map(() => 0));

  useFrame(({ camera, size }) => {
    const facing = (anchor: { point: Vector3; normal: Vector3 }) =>
      toCamera.current.copy(camera.position).sub(anchor.point).normalize().dot(anchor.normal);

    LABELS.forEach((label, labelIndex) => {
      const element = elements.current?.[label.id];
      if (!element) return;
      if (facing(label.anchors[inUse.current[labelIndex]]) < FACING_ENOUGH) {
        let best = 0;
        for (let index = 1; index < label.anchors.length; index += 1) {
          if (facing(label.anchors[index]) > facing(label.anchors[best])) best = index;
        }
        inUse.current[labelIndex] = best;
      }
      const anchor = label.anchors[inUse.current[labelIndex]];
      projected.current.copy(anchor.point).project(camera);
      const x = (projected.current.x * 0.5 + 0.5) * size.width;
      const y = (-projected.current.y * 0.5 + 0.5) * size.height;
      element.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      element.style.opacity = facing(anchor) > FACING_ENOUGH ? "1" : "0";
    });
  });

  return null;
}

export interface HeartViewerProps {
  colors: Partial<Record<VesselId, string>>; // risk colour per artery; missing = no estimate
  labelElements: RefObject<LabelElements>; // DOM labels to keep over the arteries
  selectedVessel: VesselId | null;
  hoveredVessel: VesselId | null;
  viewRequest: ViewRequest | null;
  reducedMotion: boolean;
  onSelectVessel: (id: VesselId) => void;
  onSelectHeart: () => void;
  onHoverVessel: (id: VesselId | null, pointer?: ArteryPointer) => void;
  onModelError: () => void;
}

export default function HeartViewer({
  colors,
  labelElements,
  selectedVessel,
  hoveredVessel,
  viewRequest,
  reducedMotion,
  onSelectVessel,
  onSelectHeart,
  onHoverVessel,
  onModelError,
}: HeartViewerProps) {
  const standIn = <ProxyHeart onSelectHeart={onSelectHeart} />;
  const leftMain = arteryPath("left_main");

  return (
    <Canvas
      flat
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: START_POSITION, fov: 35, near: 0.5, far: 40 }}
      onCreated={({ camera }) => camera.lookAt(TARGET)}
    >
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 5, 6]} intensity={1.6} />
      <directionalLight position={[-5, 1, -4]} intensity={0.7} />

      {HEART_MODEL_URL ? (
        <ModelErrorBoundary fallback={standIn} onError={onModelError}>
          <Suspense fallback={standIn}>
            <HeartModel url={HEART_MODEL_URL} onSelectHeart={onSelectHeart} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        standIn
      )}

      {leftMain && <Artery path={leftMain} objectName="artery-left-main" color={LEFT_MAIN_COLOR} />}
      {VESSELS.map((vessel) => {
        const path = ARTERY_PATHS.find((candidate) => candidate.id === vessel.id);
        if (!path) return null;
        return (
          <Artery
            key={vessel.id}
            path={path}
            objectName={vessel.objectName}
            color={colors[vessel.id] ?? NO_ESTIMATE_COLOR}
            selected={selectedVessel === vessel.id}
            hovered={hoveredVessel === vessel.id}
            reducedMotion={reducedMotion}
            onSelect={onSelectVessel}
            onHover={onHoverVessel}
          />
        );
      })}

      <OrbitControls makeDefault enablePan={false} minDistance={3.8} maxDistance={10} target={TARGET} />
      <CameraRig request={viewRequest} reducedMotion={reducedMotion} />
      <LabelProjector elements={labelElements} />
    </Canvas>
  );
}
