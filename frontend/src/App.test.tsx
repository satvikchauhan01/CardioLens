import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { FeatureValue } from "./api/types";
import { riskColor } from "./config/risk";
import { jsonResponse, META, METRICS, predictResponse, SAMPLES } from "./test/fixtures";

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
    "/api/metrics": () => jsonResponse(METRICS),
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
// The same input can be in the quick controls and in the full form.
const form = () => within(screen.getByRole("group", { name: "All clinical inputs" }));
const quick = () => within(screen.getByRole("group", { name: "Quick what-if controls" }));
const ageInput = () => form().getByLabelText(/^Age/) as HTMLInputElement;
const delta = (target: string) => document.querySelector(`[data-delta="${target}"]`)?.textContent ?? null;
const truth = (target: string) => document.querySelector(`[data-truth="${target}"]`)?.textContent ?? null;
const truthToggle = () =>
  screen.getByRole("checkbox", { name: "Show dataset angiography result" }) as HTMLInputElement;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

    fireEvent.keyDown(tab("Patient analysis"), { key: "ArrowLeft" });
    expect(isSelected("Model & method")).toBe(true);
    expect(document.activeElement).toBe(tab("Model & method"));
  });

  it("keeps one tab in the tab order and ignores other keys", () => {
    mockApi();
    render(<App />);

    expect([tab("Patient analysis").tabIndex, tab("Model & method").tabIndex]).toEqual([0, -1]);
    expect(tab("Patient analysis").getAttribute("aria-controls")).toBe(screen.getByRole("tabpanel").id);

    fireEvent.keyDown(tab("Patient analysis"), { key: "ArrowDown" });
    fireEvent.keyDown(tab("Patient analysis"), { key: "a" });
    expect(isSelected("Patient analysis")).toBe(true);

    fireEvent.click(tab("Model & method"));
    expect([tab("Patient analysis").tabIndex, tab("Model & method").tabIndex]).toEqual([-1, 0]);
    expect(tab("Model & method").getAttribute("aria-controls")).toBe(screen.getByRole("tabpanel").id);
    expect(tab("Patient analysis").getAttribute("aria-controls")).toBeNull();
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
    // Age is also a quick control, so the message is at both places.
    expect(screen.getAllByText("Must be between 30 and 86 (range seen in the dataset).")).toHaveLength(2);
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
    await pause(500);
    expect(predicted().some((features) => features.age === 80)).toBe(false);
  });
});

describe("what-if explorer end to end (T8.1)", () => {
  const ageSlider = () => quick().getByRole("slider", { name: "Age slider" }) as HTMLInputElement;

  it("shows how every estimate changed after a quick-control edit, then resets without a request (UF-3)", async () => {
    const { predicted } = await boot();
    expect(delta("lad")).toBeNull();
    expect(screen.queryByText(/^Modified/)).toBeNull();

    fireEvent.change(ageSlider(), { target: { value: "72" } });

    // The quick control and the full form show the new value at once.
    expect((quick().getByLabelText(/^Age \(/) as HTMLInputElement).value).toBe("72");
    expect(ageInput().value).toBe("72");
    expect(screen.getByText("Modified (1 field)")).toBeTruthy();

    await waitFor(() => expect(delta("lad")).toBe("58% → 90%, +32 pp"), { timeout: 2000 });
    expect(delta("cad")).toBe("81% → 81%, 0 pp");
    expect(delta("lcx")).toBe("22% → 22%, 0 pp");
    expect(delta("rca")).toBe("44% → 44%, 0 pp");
    expect(arteryColor(/^LAD/)).toBe(riskColor(0.9));
    expect(predicted()).toEqual([SAMPLES[0].features, { ...SAMPLES[0].features, age: 72 }]);

    fireEvent.click(screen.getByRole("button", { name: "Reset to original" }));

    expect(listRow(/^LAD/).textContent).toBe("LAD · Left Anterior Descending58%Stenosis predictedModerate");
    expect(document.querySelector("[data-delta]")).toBeNull();
    expect(screen.queryByText(/^Modified/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset to original" })).toBeNull();
    expect(ageInput().value).toBe("60");
    expect(ageSlider().value).toBe("60");
    expect(arteryColor(/^LAD/)).toBe(riskColor(0.581));
    await pause(500);
    expect(predicted()).toHaveLength(2);
  });

  it("counts every modified field and sends the quick-control values to the model", async () => {
    const { predicted } = await boot();

    fireEvent.click(quick().getByRole("switch", { name: /Typical chest pain/ }));
    fireEvent.click(quick().getByRole("radio", { name: "Female" }));

    expect(screen.getByText("Modified (2 fields)")).toBeTruthy();
    expect((form().getByLabelText("Sex") as HTMLSelectElement).value).toBe("Female");
    expect(form().getByRole("switch", { name: /Typical chest pain/ })).toHaveProperty("checked", false);
    await waitFor(() => expect(predicted()).toHaveLength(2), { timeout: 2000 });
    expect(predicted()[1]).toEqual({ ...SAMPLES[0].features, typical_chest_pain: false, sex: "Female" });

    // Putting one value back leaves one modified field.
    fireEvent.click(quick().getByRole("radio", { name: "Male" }));
    expect(screen.getByText("Modified (1 field)")).toBeTruthy();
  });

  it("drops an edit that is still waiting when the patient is reset", async () => {
    const { predicted } = await boot();

    fireEvent.change(ageSlider(), { target: { value: "80" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset to original" }));

    expect(screen.queryByText("Updating…")).toBeNull();
    await pause(500);
    expect(predicted()).toEqual([SAMPLES[0].features]);
  });
});

describe("ground-truth reveal end to end (T8.2)", () => {
  it("reveals the dataset labels of an unmodified sample and hides them once inputs change (UF-5)", async () => {
    await boot();
    expect(truthToggle().checked).toBe(false);
    expect(document.querySelector("[data-truth]")).toBeNull();

    fireEvent.click(truthToggle());

    // Sample A: all four labels positive; the mocked model predicts CAD and LAD only.
    expect(truth("cad")).toBe("Dataset label: CAD ✓ (matches the model's prediction)");
    expect(truth("lad")).toBe("Dataset label: Stenotic ✓ (matches the model's prediction)");
    expect(truth("lcx")).toBe("Dataset label: Stenotic ✗ (differs from the model's prediction)");
    expect(truth("rca")).toBe("Dataset label: Stenotic ✗ (differs from the model's prediction)");
    expect(screen.getByText("The model's prediction matches the dataset label for 2 of 4 targets.")).toBeTruthy();

    fireEvent.change(ageInput(), { target: { value: "72" } });

    expect(document.querySelector("[data-truth]")).toBeNull();
    expect(truthToggle().disabled).toBe(true);
    expect(truthToggle().checked).toBe(false);
    expect(screen.getByText(/^Hidden while inputs are modified/)).toBeTruthy();

    // Back on the original patient, the labels are shown again.
    fireEvent.click(screen.getByRole("button", { name: "Reset to original" }));
    expect(truthToggle().disabled).toBe(false);
    expect(truthToggle().checked).toBe(true);
    expect(truth("lcx")).toBe("Dataset label: Stenotic ✗ (differs from the model's prediction)");
  });

  it("has nothing to reveal for typical values, and shows each sample its own labels", async () => {
    await boot();
    fireEvent.click(truthToggle());

    fireEvent.click(screen.getByRole("button", { name: "Start from typical values" }));
    expect(truthToggle().disabled).toBe(true);
    expect(document.querySelector("[data-truth]")).toBeNull();
    expect(screen.getByText("Only sample patients have a dataset label to compare with.")).toBeTruthy();

    // Sample B (CAD and LCX positive); at its age the mocked model predicts CAD and LAD.
    fireEvent.click(screen.getByRole("button", { name: /Sample B/ }));
    await waitFor(() => expect(truth("lad")).toBe("Dataset label: Normal ✗ (differs from the model's prediction)"));
    expect(truth("cad")).toBe("Dataset label: CAD ✓ (matches the model's prediction)");
    expect(truth("lcx")).toBe("Dataset label: Stenotic ✗ (differs from the model's prediction)");
    expect(truth("rca")).toBe("Dataset label: Normal ✓ (matches the model's prediction)");
  });

  it("is switched off by Reset demo", async () => {
    const { predicted } = await boot();
    fireEvent.click(truthToggle());
    expect(truth("cad")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));

    await waitFor(() => expect(predicted()).toHaveLength(2));
    await waitFor(() => expect(screen.queryByText("Updating…")).toBeNull());
    expect(truthToggle().checked).toBe(false);
    expect(document.querySelector("[data-truth]")).toBeNull();
  });
});

describe("Model & method tab end to end (T8.3)", () => {
  const overview = () => screen.findByRole("table", { name: /^Cross-validated results of the model selected/ });

  it("loads the evaluation the first time the tab is opened, and only once (UF-6)", async () => {
    const { calls } = await boot();
    expect(calls("/api/metrics")).toHaveLength(0);

    fireEvent.click(tab("Model & method"));
    expect(screen.getByRole("status").textContent).toBe("Loading the evaluation results…");

    const cad = within(await overview()).getByRole("row", { name: /^CAD/ });
    expect(within(cad).getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Logistic regression", "212 / 85", "0.917 ± 0.031", "0.857 ± 0.031", "0.897 ± 0.031", "0.887 ± 0.031",
      "0.767 ± 0.031", "0.897 ± 0.031", "0.957 ± 0.031", "0.083 ± 0.031",
    ]);
    expect(screen.getByRole("img", { name: /^ROC curves for CAD/ }).getAttribute("src")).toBe(
      "/static/plots/cad_roc.png",
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(disclaimer()).toBe(DISCLAIMER_TEXT);
    expect(calls("/api/metrics")).toHaveLength(1);

    fireEvent.click(tab("Patient analysis"));
    fireEvent.click(tab("Model & method"));
    expect(await overview()).toBeTruthy();
    expect(calls("/api/metrics")).toHaveLength(1);
  });

  it("shows an error with Retry when the evaluation cannot be loaded, without touching the analysis", async () => {
    let failing = true;
    const { calls, predicted } = await boot({
      "/api/metrics": () =>
        failing
          ? jsonResponse({ error: { code: "MODEL_UNAVAILABLE", message: "Artifacts are not loaded." } }, 503)
          : jsonResponse(METRICS),
    });

    fireEvent.click(tab("Model & method"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The evaluation results could not be loaded.");
    expect(alert.textContent).toContain("Artifacts are not loaded.");

    failing = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await overview()).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(calls("/api/metrics")).toHaveLength(2);

    fireEvent.click(tab("Patient analysis"));
    expect(listRow(/^LAD/).textContent).toContain("58%");
    expect(predicted()).toHaveLength(1);
  });
});
