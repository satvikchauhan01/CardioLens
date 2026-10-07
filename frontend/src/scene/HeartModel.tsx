// A provided heart mesh (GLB). Used only when HEART_MODEL_URL is set; a load failure is caught by
// ModelErrorBoundary, which shows the stand-in heart instead.

import { useGLTF } from "@react-three/drei";
import { heartPointerHandlers } from "./ProxyHeart";

interface HeartModelProps {
  url: string;
  onSelectHeart: () => void;
}

export function HeartModel({ url, onSelectHeart }: HeartModelProps) {
  // No Draco: its decoder would be fetched from a CDN (D-007). The meshopt decoder is bundled.
  const { scene } = useGLTF(url, false, true);
  return <primitive object={scene} {...heartPointerHandlers(onSelectHeart)} />;
}
