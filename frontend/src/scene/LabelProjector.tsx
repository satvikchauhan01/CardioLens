// Keeps the page's label elements over their arteries. The labels are ordinary DOM elements owned
// by ViewerPanel; this only moves them, once per drawn frame.

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import { Raycaster, Vector3, type Camera, type Intersection, type Object3D } from "three";
import type { VesselId } from "../config/vessels";
import type { ArteryPath } from "./arteryPaths";
import { chooseAnchor, type LabelElements } from "./labelAnchors";

const OCCLUSION_MARGIN = 0.03; // a hit this close in front of an anchor is the surface it sits on

interface LabelProjectorProps {
  elements: RefObject<LabelElements>;
  paths: readonly ArteryPath[];
  // What can hide an anchor: the heart. Without it, an anchor is usable whenever it faces the camera.
  occluder?: RefObject<Object3D | null>;
}

export function LabelProjector({ elements, paths, occluder }: LabelProjectorProps) {
  const camera = useRef<Camera | null>(null);

  // Everything the frame loop needs is made once here, so drawing a frame allocates nothing.
  const labels = useMemo(() => {
    const raycaster = new Raycaster();
    // Understood by the accelerated raycast of the heart model; harmless otherwise.
    (raycaster as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    const toCamera = new Vector3();
    const direction = new Vector3();
    const hits: Intersection[] = [];

    return paths
      .filter((path) => path.interactive)
      .map((path) => {
        const anchors = path.labelAnchors.map((anchor) => ({
          point: new Vector3(...anchor.point),
          normal: new Vector3(...anchor.normal),
        }));
        return {
          id: path.id as VesselId,
          anchors,
          facing: (index: number) =>
            toCamera.copy(camera.current!.position).sub(anchors[index].point).normalize().dot(anchors[index].normal),
          hidden: (index: number) => {
            const blocker = occluder?.current;
            if (!blocker) return false;
            const from = camera.current!.position;
            const distance = direction.copy(anchors[index].point).sub(from).length();
            raycaster.set(from, direction.divideScalar(distance));
            raycaster.far = distance - OCCLUSION_MARGIN;
            hits.length = 0;
            return raycaster.intersectObject(blocker, false, hits).length > 0;
          },
        };
      });
  }, [paths, occluder]);

  const inUse = useRef<(number | null)[]>([]);
  const projected = useRef(new Vector3());

  useFrame((state) => {
    camera.current = state.camera;
    labels.forEach((label, labelIndex) => {
      const element = elements.current?.[label.id];
      if (!element) return;
      const chosen = chooseAnchor(label.anchors.length, inUse.current[labelIndex] ?? null, label.facing, label.hidden);
      inUse.current[labelIndex] = chosen;
      if (chosen === null) {
        element.style.opacity = "0";
        return;
      }
      projected.current.copy(label.anchors[chosen].point).project(state.camera);
      const x = (projected.current.x * 0.5 + 0.5) * state.size.width;
      const y = (-projected.current.y * 0.5 + 0.5) * state.size.height;
      element.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      element.style.opacity = "1";
    });
  });

  return null;
}
