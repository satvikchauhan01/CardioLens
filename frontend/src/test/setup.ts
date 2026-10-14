import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Vitest globals are off, so Testing Library's automatic cleanup is registered here.
afterEach(cleanup);

// jsdom cannot create a WebGL context. Answer "none" quietly, so the app takes the same path as a
// browser without WebGL and renders the 2D schematic instead of loading the 3D viewer.
vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

// jsdom has no matchMedia. The tests run as a visitor who asked for reduced motion and whose
// system is light: values appear at once instead of counting up, and the theme starts light.
// A test that needs another answer stubs matchMedia itself.
window.matchMedia = ((query: string) => ({
  matches: query.includes("prefers-reduced-motion"),
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;
