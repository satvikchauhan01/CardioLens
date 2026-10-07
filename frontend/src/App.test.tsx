import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { FeatureValue } from "./api/types";
import { riskColor } from "./config/risk";
import { jsonResponse, META, predictResponse, SAMPLES } from "./test/fixtures";

// Copied from PRODUCT_SPEC §9.1 on purpose, so a change to the constant alone fails this test.
const DISCLAIMER_TEXT =
  "Educational and decision-support prototype. Estimates come from a model trained on a small public research dataset (303 patients). They are not a diagnosis and not a substitute for clinical evaluation or diagnostic imaging such as coronary angiography.";

type Route = (init?: RequestInit) => Response | Promise<Response>;

const featuresOf = (init?: RequestInit): Record<string, FeatureValue> => JSON.parse(init?.body as string).features;

/** The mocked model: the LAD estimate jumps to 90% from age 70, everything else is fixed. */
function estimate(init?: RequestInit): Response {
  const features = featuresOf(init);
  return jsonResponse(predictResponse(features, (features.age as number) >= 70 ? { lad: 0.9 } : {}));
}

/** A working backend; pass routes to replace an endpoint. */
function mockApi(routes: Record<string, Route> = {}) {
  const defaults: Record<string, Route> = {
    "/api/meta": () => jsonResponse(META),
    "/api/samples": () => jsonResponse({ samples: SAMPLES }),
    "/api/predict": estimate,
  };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ({ ...defaults, ...routes })[url](init));
  vi.stubGlobal("fetch", fetchMock);
  const calls = (url: string) => fetchMock.mock.calls.filter(([called]) => called === url);
  const predicted = () => calls("/api/predict").map(([, init]) => featuresOf(init));
  return { calls, predicted };
}

const tab = (name: string) => screen.getByRole("tab", { name });
const isSelected = (name: string) => tab(name).getAttribute("aria-selected") === "true";
const disclaimer = () => screen.getByRole("note", { name: "Disclaimer" }).textContent;
const pressed = (element: Element) => element.getAttribute("aria-pressed") === "true";

const cadCard = () => screen.getByRole("button", { name: /Coronary artery disease/ });
const listRow = (name: RegExp) =>
  within(screen.getByRole("list", { name: "Coronary arteries" })).getByRole("button", { name });
// Without WebGL (as in this test environment) the viewer is the 2D schematic.
const artery = (name: RegExp) =>
  within(screen.getByRole("group", { name: /Heart schematic/ })).getByRole("button", { name });
const arteryColor = (name: RegExp) => artery(name).querySelector("path[data-run]")?.getAttribute("stroke");
const arteryOutline = (name: RegExp) =>
  artery(name).querySelector('path[stroke="#0f172a"], path[stroke="#0369a1"]')?.getAttribute("stroke") ?? null;
const cssColor = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
const barColor = (target: string) =>
  document.querySelector<HTMLElement>(`[data-risk-bar="${target}"]`)?.style.backgroundColor;
const explanation = () => screen.getByRole("region", { name: /Why this estimate/ });
const ageInput = () => screen.getByLabelText(/^Age/) as HTMLInputElement;

async function boot(routes: Record<string, Route> = {}) {
  const api = mockApi(routes);
  render(<App />);
  await screen.findByRole("button", { name: /Coronary artery disease/ });
  return api;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App shell", () => {
  it("shows the name, tagline and exact disclaimer text", () => {
    mockApi();
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("CardioLens");
    expect(screen.getByText("Coronary risk estimates, mapped to the vessels they describe.")).toBeTruthy();
    expect(disclaimer()).toBe(DISCLAIMER_TEXT);
  });

  it("opens on Patient analysis and switches tabs on click, keeping the disclaimer", () => {
    mockApi();
    render(<App />);
    expect(isSelected("Patient analysis")).toBe(true);
    expect(screen.getByRole("tabpanel", { name: "Patient analysis" })).toBeTruthy();

    fireEvent.click(tab("Model & method"));
    expect(isSelected("Model & method")).toBe(true);
    expect(isSelected("Patient analysis")).toBe(false);
    expect(screen.getByRole("tabpanel", { name: "Model & method" })).toBeTruthy();
    expect(screen.queryByRole("tabpanel", { name: "Patient analysis" })).toBeNull();
    expect(disclaimer()).toBe(DISCLAIMER_TEXT);
  });

  it("switches tabs with the arrow keys and moves focus", () => {
    mockApi();
    render(<App />);

    fireEvent.keyDown(tab("Patient analysis"), { key: "ArrowRight" });
    expect(isSelected("Model & method")).toBe(true);
    expect(document.activeElement).toBe(tab("Model & method"));

    fireEvent.keyDown(tab("Model & method"), { key: "ArrowRight" });
    expect(isSelected("Patient analysis")).toBe(true);
    expect(document.activeElement).toBe(tab("Patient analysis"));
  });
});

describe("App boot (PRODUCT_SPEC §6.1)", () => {
  it("shows a loading state, then loads the first sample and its estimates (UF-1)", async () => {
    const { predicted } = mockApi();
    render(<App />);
    expect(screen.getByRole("status", { name: "Loading the model service…" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset demo" })).toBeNull();

    const cad = await screen.findByRole("button", { name: /Coronary artery disease/ });
    expect(cad.textContent).toContain("81%");
    expect(pressed(cad)).toBe(true);
    expect(pressed(screen.getByRole("button", { name: /Sample A/ }))).toBe(true);
    expect(screen.getByRole("region", { name: "Why this estimate: CAD" })).toBeTruthy();
    expect(screen.getByText(/Model version 20261007T1423Z-7393432/)).toBeTruthy();
    expect(predicted()).toEqual([SAMPLES[0].features]);
  });

  it("explains how to start the backend when it cannot be reached, and recovers on Retry", async () => {
    let reachable = false;
    mockApi({
      "/api/meta": () => {
        if (!reachable) throw new TypeError("Failed to fetch");
        return jsonResponse(META);
      },
    });
    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Can't reach the CardioLens model service.");
    expect(alert.textContent).toContain("uvicorn app.main:app --port 8000");
    expect(screen.queryByRole("button", { name: "Reset demo" })).toBeNull();
    expect(disclaimer()).toBe(DISCLAIMER_TEXT);

    reachable = true;
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: /Coronary artery disease/ })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the service's reason when the models are not ready", async () => {
    const reason = "Artifacts not found in backend/artifacts. Run: python -m ml.train";
    mockApi({
      "/api/meta": () => jsonResponse({ error: { code: "MODEL_UNAVAILABLE", message: reason } }, 503),
    });
    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(`Model service not ready: ${reason}`);
    expect(alert.textContent).not.toContain("uvicorn");
  });
});

describe("end to end with a mocked API (T7.1)", () => {
  it("maps each estimate onto its artery and its result row with one colour scale", async () => {
    await boot();

    // Sample A in the mock: LAD 58%, LCX 22%, RCA 44%, CAD 81%.
    expect(arteryColor(/^LAD · Left Anterior Descending · 58%$/)).toBe(riskColor(0.581));
    expect(arteryColor(/^LCX · Left Circumflex · 22%$/)).toBe(riskColor(0.2207));
    expect(arteryColor(/^RCA · Right Coronary Artery · 44%$/)).toBe(riskColor(0.4402));
    expect(barColor("lad")).toBe(cssColor(riskColor(0.581)));
    expect(barColor("lcx")).toBe(cssColor(riskColor(0.2207)));
    expect(barColor("rca")).toBe(cssColor(riskColor(0.4402)));
    expect(barColor("cad")).toBe(cssColor(riskColor(0.8123)));
    expect(listRow(/^LAD/).textContent).toContain("58%");
    expect(screen.getByText(/It does not show where along the artery a narrowing might be/)).toBeTruthy();
  });

  it("selects a vessel from the viewer: list row, explanation and viewer agree, with no new request", async () => {
    const { predicted } = await boot();

    fireEvent.click(artery(/^LCX/));

    expect(pressed(artery(/^LCX/))).toBe(true);
    expect(pressed(listRow(/^LCX/))).toBe(true);
    expect(pressed(cadCard())).toBe(false);
    expect(explanation().textContent).toContain("Why this estimate: LCX");
    expect(explanation().textContent).toContain("Summary for lcx.");
    expect(arteryOutline(/^LCX/)).toBe("#0f172a");
    expect(predicted()).toHaveLength(1);
  });

  it("selects a vessel from the list, and CAD from the heart or the CAD card", async () => {
    await boot();

    fireEvent.click(listRow(/^RCA/));
    expect(pressed(artery(/^RCA/))).toBe(true);
    expect(explanation().textContent).toContain("Why this estimate: RCA");

    fireEvent.click(document.querySelector('[data-part="heart"]')!);
    expect(pressed(cadCard())).toBe(true);
    expect(pressed(artery(/^RCA/))).toBe(false);
    expect(explanation().textContent).toContain("Why this estimate: CAD");

    fireEvent.click(listRow(/^LAD/));
    fireEvent.click(cadCard());
    expect(explanation().textContent).toContain("Why this estimate: CAD");
  });

  it("highlights the same vessel in the viewer and the list on hover", async () => {
    await boot();
    const highlighted = (row: Element) => row.className.split(" ").includes("border-brand");

    fireEvent.mouseEnter(listRow(/^RCA/));
    expect(arteryOutline(/^RCA/)).toBe("#0369a1");
    expect(arteryOutline(/^LAD/)).toBeNull();
    fireEvent.mouseLeave(listRow(/^RCA/));
    expect(arteryOutline(/^RCA/)).toBeNull();

    expect(highlighted(listRow(/^LAD/))).toBe(false);
    fireEvent.mouseEnter(artery(/^LAD/));
    expect(highlighted(listRow(/^LAD/))).toBe(true);
    fireEvent.mouseLeave(artery(/^LAD/));
    expect(highlighted(listRow(/^LAD/))).toBe(false);
  });

  it("updates colours, estimates and explanations after an edit, once the debounce has passed (UF-3)", async () => {
    const { predicted } = await boot();

    fireEvent.change(ageInput(), { target: { value: "7" } });
    fireEvent.change(ageInput(), { target: { value: "72" } });
    expect(screen.getAllByText("Updating…")).toHaveLength(2);
    expect(predicted()).toHaveLength(1);

    await waitFor(() => expect(listRow(/^LAD/).textContent).toContain("90%"), { timeout: 2000 });
    expect(predicted()).toEqual([SAMPLES[0].features, { ...SAMPLES[0].features, age: 72 }]);
    expect(arteryColor(/^LAD · Left Anterior Descending · 90%$/)).toBe(riskColor(0.9));
    expect(barColor("lad")).toBe(cssColor(riskColor(0.9)));
    expect(listRow(/^LAD/).textContent).toContain("High");
    expect(screen.queryByText("Updating…")).toBeNull();
  });

  it("sends nothing for invalid input and marks the viewer and the results as out of date", async () => {
    const { predicted } = await boot();

    fireEvent.change(ageInput(), { target: { value: "200" } });

    await waitFor(
      () => expect(screen.getAllByText("Out of date — fix highlighted fields")).toHaveLength(2),
      { timeout: 2000 },
    );
    expect(screen.getByText("Must be between 30 and 86 (range seen in the dataset).")).toBeTruthy();
    expect(predicted()).toHaveLength(1);
    expect(arteryColor(/^LAD/)).toBe(riskColor(0.581));

    // Fixing the field resumes the updates at once.
    fireEvent.change(ageInput(), { target: { value: "75" } });
    await waitFor(() => expect(listRow(/^LAD/).textContent).toContain("90%"));
    expect(screen.queryByText("Out of date — fix highlighted fields")).toBeNull();
  });

  it("predicts again when another patient is loaded", async () => {
    const { predicted } = await boot();

    fireEvent.click(screen.getByRole("button", { name: /Sample B/ }));

    await waitFor(() => expect(predicted()).toHaveLength(2));
    expect(predicted()[1]).toEqual(SAMPLES[1].features);
    await waitFor(() => expect(pressed(screen.getByRole("button", { name: /Sample B/ }))).toBe(true));
    expect(ageInput().value).toBe("71");
    await waitFor(() => expect(arteryColor(/^LAD/)).toBe(riskColor(0.9)));
  });

  it("keeps the loaded patient and the selection when switching tabs", async () => {
    const { predicted } = await boot();
    fireEvent.click(listRow(/^LAD/));

    fireEvent.click(tab("Model & method"));
    fireEvent.click(tab("Patient analysis"));

    expect(pressed(listRow(/^LAD/))).toBe(true);
    expect(predicted()).toHaveLength(1);
  });

  it("shows a prediction failure with Retry and recovers", async () => {
    let failing = true;
    const { predicted } = mockApi({
      "/api/predict": (init) =>
        failing
          ? jsonResponse({ error: { code: "INTERNAL_ERROR", message: "Something went wrong on the server." } }, 500)
          : estimate(init),
    });
    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The estimates could not be updated.");
    expect(alert.textContent).toContain("Something went wrong on the server.");
    expect(arteryColor(/^LAD · Left Anterior Descending · no estimate$/)).toBe(riskColor(null));

    failing = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: /Coronary artery disease/ })).toBeTruthy();
    expect(predicted()).toHaveLength(2);
    expect(arteryColor(/^LAD/)).toBe(riskColor(0.581));
  });

  it("Reset demo returns to the first sample, CAD and the analysis tab", async () => {
    const { predicted } = await boot();
    fireEvent.click(screen.getByRole("button", { name: /Sample B/ }));
    await waitFor(() => expect(pressed(screen.getByRole("button", { name: /Sample B/ }))).toBe(true));
    fireEvent.click(listRow(/^LCX/));
    fireEvent.change(ageInput(), { target: { value: "80" } });
    fireEvent.click(tab("Model & method"));

    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));

    expect(isSelected("Patient analysis")).toBe(true);
    expect(pressed(screen.getByRole("button", { name: /Sample A/ }))).toBe(true);
    expect(pressed(cadCard())).toBe(true);
    expect(ageInput().value).toBe("60");
    await waitFor(() => expect(listRow(/^LAD/).textContent).toContain("58%"));
    expect(predicted().at(-1)).toEqual(SAMPLES[0].features);
    // The edit that was pending when the demo was reset is never sent.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(predicted().some((features) => features.age === 80)).toBe(false);
  });
});
