import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Vitest globals are off, so Testing Library's automatic cleanup is registered here.
afterEach(cleanup);

// jsdom cannot create a WebGL context. Answer "none" quietly, so the app takes the same path as a
// browser without WebGL and renders the 2D schematic instead of loading the 3D viewer.
vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
