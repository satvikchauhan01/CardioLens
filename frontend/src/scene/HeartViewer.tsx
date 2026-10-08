// The WebGL scene (F5). Loaded lazily, so three.js stays out of the first bundle.
// Performance choices (ARCHITECTURE §7): frames are drawn on demand, pixel ratio is capped at 1.5,
// three lights, no shadows, no environment map, nothing allocated per frame.

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, type RefObject } from "react";
import { MathUtils, Spherical, Vector3, type Mesh } from "three";
import { NO_ESTIMATE_COLOR } from "../config/risk";
import { HEART_MODEL_URL, VESSELS, type VesselId } from "../config/vessels";
import { Artery, type ArteryPointer } from "./Artery";
import { ARTERY_PATHS, arteryPath } from "./arteryPaths";
import { HeartModel, preloadHeartModel } from "./HeartModel";
import { MODEL_ARTERY_PATHS } from "./heartModelData";
import type { LabelElements } from "./labelAnchors";
import { LabelProjector } from "./LabelProjector";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { NEUTRAL_VESSEL_COLOR, ProxyHeart } from "./ProxyHeart";
import {
  CAMERA_DISTANCE,
  CAMERA_TARGET,
  VIEW_TRANSITION_SECONDS,
  VIEWS,
  type ViewId,
  type ViewRequest,
} from "./ViewPresets";

const TARGET = new Vector3(...CAMERA_TARGET);

// This file is the lazy 3D chunk: the model's download starts as soon as it has arrived.
if (HEART_MODEL_URL) preloadHeartModel(HEART_MODEL_URL);

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

type SceneProps = Omit<HeartViewerProps, "viewRequest" | "onModelError">;

/** The stand-in heart with tube arteries: shown when there is no model file, or it cannot be used. */
function StandInScene({
  colors,
  labelElements,
  selectedVessel,
  hoveredVessel,
  reducedMotion,
  onSelectVessel,
  onSelectHeart,
  onHoverVessel,
}: SceneProps) {
  const leftMain = arteryPath("left_main");

  return (
    <>
      <ProxyHeart onSelectHeart={onSelectHeart} />
      {leftMain && <Artery path={leftMain} objectName="artery-left-main" color={NEUTRAL_VESSEL_COLOR} />}
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
      <LabelProjector elements={labelElements} paths={ARTERY_PATHS} />
    </>
  );
}

/** The heart model with its own artery meshes. Labels hide where the heart covers an artery. */
function ModelScene({ url, labelElements, ...model }: SceneProps & { url: string }) {
  const heart = useRef<Mesh>(null);

  return (
    <>
      <HeartModel url={url} heartRef={heart} {...model} />
      <LabelProjector elements={labelElements} paths={MODEL_ARTERY_PATHS} occluder={heart} />
    </>
  );
}

export default function HeartViewer({ viewRequest, onModelError, ...scene }: HeartViewerProps) {
  const standIn = <StandInScene {...scene} />;

  return (
    <Canvas
      flat
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ position: START_POSITION, fov: 35, near: 0.5, far: 40 }}
      onCreated={({ camera, gl, invalidate }) => {
        camera.lookAt(TARGET);
        // Frames are drawn on demand, so after the browser restores a lost graphics context
        // (a driver reset, waking from sleep) nothing else would draw the scene again.
        gl.domElement.addEventListener("webglcontextrestored", () => invalidate());
      }}
    >
      {/* A low ambient level and a strong key light, so the shape of the heart reads from every side. */}
      <ambientLight intensity={1.0} />
      <directionalLight position={[3, 5, 6]} intensity={2.1} />
      <directionalLight position={[-5, 1, -4]} intensity={1.3} />

      {HEART_MODEL_URL ? (
        <ModelErrorBoundary fallback={standIn} onError={onModelError}>
          {/* Nothing is drawn while the model loads: a different heart first would only flash. */}
          <Suspense fallback={null}>
            <ModelScene url={HEART_MODEL_URL} {...scene} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        standIn
      )}

      <OrbitControls makeDefault enablePan={false} minDistance={3.8} maxDistance={10} target={TARGET} />
      <CameraRig request={viewRequest} reducedMotion={scene.reducedMotion} />
    </Canvas>
  );
}
