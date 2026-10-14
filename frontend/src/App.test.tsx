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
  // The estimates for the cards on the Patients page are marked as less urgent; the analysis is not.
  const background = (init?: RequestInit) => (init as { priority?: string } | undefined)?.priority === "low";
  const predicted = () => calls("/api/predict").filter(([, init]) => !background(init)).map(([, init]) => featuresOf(init));
  const estimated = () => calls("/api/predict").filter(([, init]) => background(init)).map(([, init]) => featuresOf(init));
  return { calls, predicted, estimated };
}

const mockedEstimate = estimate;
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
// The wide line under a selected (ink) or hovered (the artery's own rim colour) artery in the schematic.
const arteryOutline = (name: RegExp) =>
  artery(name).querySelector('path[stroke="#0f172a"]')?.getAttribute("stroke") ??
  Array.from(artery(name).querySelectorAll("path")).find((path) => path.getAttribute("stroke-width") === "17")?.getAttribute("stroke") ??
  null;
const cssColor = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;
// A vessel's estimate is a bar, the overall one the arc of a gauge.
const barColor = (target: string) => {
  const bar = document.querySelector<HTMLElement>(`[data-risk-bar="${target}"]`);
  const stroke = bar?.getAttribute("stroke");
  return stroke ? cssColor(stroke) : bar?.style.backgroundColor;
};
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
// The card on the Analysis page that names the patient in analysis.
const patientCard = () => screen.getByRole("heading", { name: "Patient" }).closest("section")!.textContent ?? "";
/** Chooses a sample on the Patients page, which opens its analysis. */
function chooseSample(title: string) {
  fireEvent.click(tab("Patients"));
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Analyse ${title},`) }));
}

const HOME_TITLE = "See which coronary artery a model is concerned about, and why.";

/** A visit that starts on the Analysis page, with the first sample analysed. */
async function boot(routes: Record<string, Route> = {}) {
  window.history.replaceState(null, "", "#analysis");
  const api = mockApi(routes);
  render(<App />);
  await screen.findByRole("button", { name: /Coronary artery disease/ });
  return api;
}

/** A visit to the bare address: the app opens on Home. */
async function bootHome(routes: Record<string, Route> = {}) {
  const api = mockApi(routes);
  render(<App />);
  await screen.findByRole("heading", { name: HOME_TITLE });
  return api;
}

afterEach(() => {
  vi.unstubAllGlobals();
  // Each test starts without a page in the address.
  window.history.replaceState(null, "", window.location.pathname);
});

describe("App shell", () => {
  it("shows the name, tagline and exact disclaimer text", () => {
    mockApi();
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("CardioLens");
    expect(screen.getByText("Coronary risk estimates, mapped to the vessels they describe.")).toBeTruthy();
    expect(disclaimer()).toBe(DISCLAIMER_TEXT);
  });

  it("has five pages, opens on Home and switches on click, keeping the disclaimer", () => {
    mockApi();
    render(<App />);
    expect(screen.getAllByRole("tab").map((element) => element.textContent)).toEqual([
      "Home", "Patients", "New patient", "Analysis", "Model & method",
    ]);
    expect(isSelected("Home")).toBe(true);
    expect(screen.getByRole("tabpanel", { name: "Home" })).toBeTruthy();

    fireEvent.click(tab("Model & method"));
    expect(isSelected("Model & method")).toBe(true);
    expect(isSelected("Home")).toBe(false);
    expect(screen.getByRole("tabpanel", { name: "Model & method" })).toBeTruthy();
    expect(screen.queryByRole("tabpanel", { name: "Home" })).toBeNull();
    expect(disclaimer()).toBe(DISCLAIMER_TEXT);
  });

  it("switches pages with the arrow keys, around both ends, and moves focus", () => {
    mockApi();
    render(<App />);

    fireEvent.keyDown(tab("Home"), { key: "ArrowLeft" });
    expect(isSelected("Model & method")).toBe(true);
    expect(document.activeElement).toBe(tab("Model & method"));

    fireEvent.keyDown(tab("Model & method"), { key: "ArrowRight" });
    expect(isSelected("Home")).toBe(true);
    expect(document.activeElement).toBe(tab("Home"));

    for (const page of ["Patients", "New patient", "Analysis"]) {
      fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
      expect(isSelected(page)).toBe(true);
      expect(document.activeElement).toBe(tab(page));
    }
    fireEvent.keyDown(tab("Analysis"), { key: "ArrowLeft" });
    expect(isSelected("New patient")).toBe(true);
  });

  it("keeps one tab in the tab order and ignores other keys", () => {
    mockApi();
    render(<App />);
    const order = () => screen.getAllByRole("tab").map((element) => (element as HTMLElement).tabIndex);

    expect(order()).toEqual([0, -1, -1, -1, -1]);
    expect(tab("Home").getAttribute("aria-controls")).toBe(screen.getByRole("tabpanel").id);

    fireEvent.keyDown(tab("Home"), { key: "ArrowDown" });
    fireEvent.keyDown(tab("Home"), { key: "a" });
    expect(isSelected("Home")).toBe(true);

    fireEvent.click(tab("Model & method"));
    expect(order()).toEqual([-1, -1, -1, -1, 0]);
    expect(tab("Model & method").getAttribute("aria-controls")).toBe(screen.getByRole("tabpanel").id);
    expect(tab("Home").getAttribute("aria-controls")).toBeNull();
  });

  it("gives each page its own address and follows the browser's Back button", async () => {
    await bootHome();
    expect(window.location.hash).toBe("");

    fireEvent.click(tab("Patients"));
    expect(window.location.hash).toBe("#patients");
    fireEvent.click(tab("Model & method"));
    expect(window.location.hash).toBe("#method");

    // Back: the address changes first, then the page follows it.
    window.history.replaceState(null, "", "#patients");
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(isSelected("Patients")).toBe(true);

    // An address that names no page shows the page the app opens on.
    window.history.replaceState(null, "", "#nowhere");
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(isSelected("Home")).toBe(true);
  });

  it("switches between the light and the dark theme, starting from the system's", () => {
    mockApi();
    render(<App />);
    expect(document.documentElement.dataset.theme).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "Switch to the dark theme" }));
    expect(document.documentElement.dataset.theme).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Switch to the light theme" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(disclaimer()).toBe(DISCLAIMER_TEXT);
  });

  it("starts in the dark theme where the system is dark", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    mockApi();
    render(<App />);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to the light theme" })).toBeTruthy();
  });

  it("opens on the page named in the address", () => {
    window.history.replaceState(null, "", "#new");
    mockApi();
    render(<App />);

    expect(isSelected("New patient")).toBe(true);
  });
});

describe("App boot (PRODUCT_SPEC §6.1)", () => {
  it("shows a loading state, then opens Home and analyses the first sample behind it (UF-1)", async () => {
    const { predicted } = mockApi();
    render(<App />);
    expect(screen.getByRole("status", { name: "Loading the model service…" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset demo" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Take the tour" })).toBeNull();

    // Home is on screen; the first sample is analysed without being asked for.
    expect(await screen.findByRole("heading", { name: HOME_TITLE })).toBeTruthy();
    expect(isSelected("Home")).toBe(true);
    expect(await screen.findByText("Sample A: each artery is coloured by its model estimate. Drag to turn the heart.")).toBeTruthy();
    expect(predicted()).toEqual([SAMPLES[0].features]);

    fireEvent.click(tab("Analysis"));
    const cad = screen.getByRole("button", { name: /Coronary artery disease/ });
    expect(cad.textContent).toContain("81%");
    expect(pressed(cad)).toBe(true);
    expect(patientCard()).toContain("Sample A60 y · MaleHeld out — not used for training or validation.");
    expect(screen.getByRole("region", { name: "Why this estimate: CAD" })).toBeTruthy();
    expect(screen.getByText(/Model version 20261011T1756Z-7393432/)).toBeTruthy();
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
    expect(await screen.findByRole("heading", { name: HOME_TITLE })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0", ".\\.venv\\Scripts\\Activate.ps1"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/141.0", "source .venv/bin/activate"],
  ])("shows the start commands of the system the browser runs on (%s)", async (userAgent, activation) => {
    const agent = vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
    mockApi({
      "/api/meta": () => {
        throw new TypeError("Failed to fetch");
      },
    });
    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert.querySelector("pre")?.textContent).toBe(`cd backend\n${activation}\nuvicorn app.main:app --port 8000`);
    agent.mockRestore();
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
    expect(arteryOutline(/^RCA/)).toBe("#15803d");
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

  it("opens the analysis of the sample chosen on the Patients page, and predicts for it", async () => {
    const { predicted } = await boot();

    chooseSample("Sample B");

    expect(isSelected("Analysis")).toBe(true);
    expect(window.location.hash).toBe("#analysis");
    await waitFor(() => expect(predicted()).toHaveLength(2));
    expect(predicted()[1]).toEqual(SAMPLES[1].features);
    expect(patientCard()).toContain("Sample B71 y · Female");
    expect(ageInput().value).toBe("71");
    await waitFor(() => expect(arteryColor(/^LAD/)).toBe(riskColor(0.9)));
  });

  it("keeps the loaded patient and the selection when switching pages", async () => {
    const { predicted } = await boot();
    fireEvent.click(listRow(/^LAD/));

    for (const page of ["Model & method", "Patients", "New patient", "Analysis"]) fireEvent.click(tab(page));

    expect(pressed(listRow(/^LAD/))).toBe(true);
    expect(patientCard()).toContain("Sample A");
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
    window.history.replaceState(null, "", "#analysis");
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

  it("Reset demo returns to the first sample, CAD and the Analysis page", async () => {
    const { predicted } = await boot();
    chooseSample("Sample B");
    await waitFor(() => expect(patientCard()).toContain("Sample B"));
    fireEvent.click(listRow(/^LCX/));
    fireEvent.change(ageInput(), { target: { value: "80" } });
    fireEvent.click(tab("Model & method"));

    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));

    expect(isSelected("Analysis")).toBe(true);
    await waitFor(() => expect(patientCard()).toContain("Sample A"));
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

  it("has nothing to reveal for a patient of the user's own, and shows each sample its own labels", async () => {
    await boot();
    fireEvent.click(truthToggle());

    fireEvent.click(tab("New patient"));
    fireEvent.click(screen.getByRole("button", { name: "Analyse this patient" }));
    expect(isSelected("Analysis")).toBe(true);
    expect(truthToggle().disabled).toBe(true);
    expect(document.querySelector("[data-truth]")).toBeNull();
    expect(screen.getByText("Only sample patients have a dataset label to compare with.")).toBeTruthy();

    // Sample B (CAD and LCX positive); at its age the mocked model predicts CAD and LAD.
    chooseSample("Sample B");
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
      "Logistic regression", "210 / 81", "0.917 ± 0.031", "0.857 ± 0.031", "0.897 ± 0.031", "0.887 ± 0.031",
      "0.767 ± 0.031", "0.897 ± 0.031", "0.957 ± 0.031", "0.083 ± 0.031",
    ]);
    expect(screen.getByRole("img", { name: /^ROC curves for CAD/ }).getAttribute("src")).toBe(
      "/static/plots/cad_roc.png",
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(disclaimer()).toBe(DISCLAIMER_TEXT);
    expect(calls("/api/metrics")).toHaveLength(1);

    fireEvent.click(tab("Analysis"));
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

    fireEvent.click(tab("Analysis"));
    expect(listRow(/^LAD/).textContent).toContain("58%");
    expect(predicted()).toHaveLength(1);
  });
});

describe("the Patients and New patient pages end to end (F1, F2)", () => {
  it("shows the sample patients in two groups by their dataset label, the one in analysis marked", async () => {
    await boot();
    fireEvent.click(tab("Patients"));

    const group = (name: RegExp) => screen.getByRole("region", { name });
    const cards = (name: RegExp) => within(group(name)).getAllByRole("button").map((card) => card.getAttribute("aria-label"));
    expect(cards(/^Dataset label: CAD/)).toEqual(["Analyse Sample A, 60 y · Male", "Analyse Sample B, 71 y · Female"]);
    expect(cards(/^Dataset label: Normal/)).toEqual(["Analyse Sample C, 45 y · Female"]);
    expect(screen.getByRole("button", { name: /^Analyse Sample A,/ }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: /^Analyse Sample C,/ }).getAttribute("aria-current")).toBeNull();
  });

  it("analyses a patient without disease and compares it with its dataset labels", async () => {
    const { predicted } = await boot({
      "/api/predict": (init) => jsonResponse(predictResponse(featuresOf(init), { cad: 0.12, lad: 0.2, lcx: 0.08, rca: 0.31 })),
    });

    chooseSample("Sample C");

    await waitFor(() => expect(patientCard()).toContain("Sample C45 y · Female"));
    await waitFor(() => expect(cadCard().textContent).toContain("12%"));
    expect(cadCard().textContent).toContain("CAD not predicted");
    expect(predicted().at(-1)).toEqual(SAMPLES[2].features);
    fireEvent.click(truthToggle());
    expect(truth("cad")).toBe("Dataset label: Normal ✓ (matches the model's prediction)");
    expect(screen.getByText("The model's prediction matches the dataset label for 4 of 4 targets.")).toBeTruthy();
  });

  it("analyses a patient of the user's own: typical values, edited, sent once", async () => {
    const { predicted } = await boot();
    fireEvent.click(tab("New patient"));
    const own = within(screen.getByRole("group", { name: "Demographics & history" }));

    fireEvent.change(own.getByLabelText(/^Age/), { target: { value: "72" } });
    // Nothing is sent while the patient is being entered.
    await pause(500);
    expect(predicted()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Analyse this patient" }));

    expect(isSelected("Analysis")).toBe(true);
    await waitFor(() => expect(predicted()).toHaveLength(2));
    const typical = Object.fromEntries(META.features.map((feature) => [feature.id, feature.default]));
    expect(predicted()[1]).toEqual({ ...typical, age: 72 });
    expect(patientCard()).toContain("Your patient72 y · Male");
    expect(screen.queryByText(/^Modified/)).toBeNull();
    // From 70 years on the mocked model raises the LAD estimate.
    await waitFor(() => expect(listRow(/^LAD/).textContent).toContain("90%"));
  });

  it("does not analyse a new patient with an invalid value", async () => {
    const { predicted } = await boot();
    fireEvent.click(tab("New patient"));
    const own = within(screen.getByRole("group", { name: "Demographics & history" }));

    fireEvent.change(own.getByLabelText(/^Age/), { target: { value: "200" } });

    const analyse = screen.getByRole("button", { name: "Analyse this patient" }) as HTMLButtonElement;
    expect(analyse.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("1 field needs attention before the patient can be analysed.");
    expect(own.getByText("Must be between 30 and 86 (range seen in the dataset).")).toBeTruthy();
    fireEvent.click(analyse);
    expect(isSelected("New patient")).toBe(true);
    expect(predicted()).toHaveLength(1);
  });

  it("builds a page when it is first opened, and keeps a half-entered patient across pages", async () => {
    await boot();
    expect(document.getElementById("new-age")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Analyse Sample A,/ })).toBeNull();

    fireEvent.click(tab("New patient"));
    const age = () => document.getElementById("new-age") as HTMLInputElement;
    fireEvent.change(age(), { target: { value: "77" } });
    for (const page of ["Patients", "Analysis", "Model & method", "New patient"]) fireEvent.click(tab(page));

    expect(age().value).toBe("77");
    // The patient in analysis is still the first sample: nothing was sent for the half-entered one.
    fireEvent.click(tab("Analysis"));
    expect(ageInput().value).toBe("60");
  });

  it("leads from the analysis to the two pages where a patient is chosen", async () => {
    await boot();

    fireEvent.click(screen.getByRole("button", { name: "Choose another patient" }));
    expect(isSelected("Patients")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "New patient" }));
    expect(isSelected("New patient")).toBe(true);
  });
});

describe("Home page end to end", () => {
  it("leads into the app: the analysis, the three other pages", async () => {
    await bootHome();

    fireEvent.click(screen.getByRole("button", { name: "Open the analysis" }));
    expect(isSelected("Analysis")).toBe(true);
    expect(window.location.hash).toBe("#analysis");
    expect(patientCard()).toContain("Sample A");

    for (const [way, page] of [
      [/^Explore the sample patients/, "Patients"],
      [/^Enter a patient of your own/, "New patient"],
      [/^See how it was validated/, "Model & method"],
    ] as const) {
      fireEvent.click(tab("Home"));
      fireEvent.click(screen.getByRole("button", { name: way }));
      expect(isSelected(page)).toBe(true);
    }
  });

  it("names the patient in analysis, also after another one was chosen", async () => {
    await bootHome();
    expect(await screen.findByText(/^Sample A: each artery is coloured by its model estimate/)).toBeTruthy();

    chooseSample("Sample B");
    fireEvent.click(tab("Home"));

    expect(await screen.findByText(/^Sample B: each artery is coloured by its model estimate/)).toBeTruthy();
  });

  it("builds the Analysis page only when it is opened, with the estimates that are already there", async () => {
    const { predicted } = await bootHome();
    await waitFor(() => expect(predicted()).toHaveLength(1));
    expect(screen.queryByRole("heading", { name: "Patient" })).toBeNull();

    fireEvent.click(tab("Analysis"));

    expect(cadCard().textContent).toContain("81%");
    expect(predicted()).toHaveLength(1);
  });
});

describe("guided tour end to end", () => {
  const tourNote = () => screen.queryByRole("dialog", { name: "Guided tour" });

  it("starts from the header on any page and opens the Analysis page for it", async () => {
    await bootHome();
    fireEvent.click(tab("Model & method"));

    fireEvent.click(screen.getByRole("button", { name: "Take the tour" }));

    expect(isSelected("Analysis")).toBe(true);
    expect(tourNote()!.textContent).toContain("Step 1 of 6");
    expect(within(tourNote()!).getByRole("heading").textContent).toBe("The patient");
  });

  it("starts from the Home page as well, and ends with Finish", async () => {
    await bootHome();

    fireEvent.click(within(screen.getByRole("tabpanel")).getByRole("button", { name: "Take the tour" }));
    expect(isSelected("Analysis")).toBe(true);
    for (let step = 1; step < 6; step += 1) fireEvent.click(within(tourNote()!).getByRole("button", { name: "Next" }));
    expect(within(tourNote()!).getByRole("heading").textContent).toBe("Compare with angiography");

    fireEvent.click(within(tourNote()!).getByRole("button", { name: "Finish" }));
    expect(tourNote()).toBeNull();
    // The page it explained is as it was.
    expect(pressed(cadCard())).toBe(true);
    expect(patientCard()).toContain("Sample A");
  });

  it("every part it points at is on the Analysis page", async () => {
    await boot();

    for (const part of ["patient", "heart", "estimates", "explanation", "whatif", "labels"]) {
      expect(document.querySelector(`[data-tour="${part}"]`), part).toBeTruthy();
    }
  });

  it("ends when the page is left, and does not come back with it", async () => {
    await boot();
    fireEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    expect(tourNote()).toBeTruthy();

    // The browser's Back button: the address changes, the page follows.
    window.history.replaceState(null, "", "#patients");
    fireEvent(window, new HashChangeEvent("hashchange"));
    expect(tourNote()).toBeNull();

    fireEvent.click(tab("Analysis"));
    expect(tourNote()).toBeNull();
  });

  it("is not offered before the app has loaded", () => {
    mockApi({ "/api/meta": () => new Promise<Response>(() => undefined) });
    render(<App />);

    expect(screen.queryByRole("button", { name: "Take the tour" })).toBeNull();
    expect(screen.getByRole("button", { name: "Switch to the dark theme" })).toBeTruthy();
  });
});

describe("the models' estimates on the patient cards end to end", () => {
  const estimate = (id: string) => document.querySelector<HTMLElement>(`[data-estimate="${id}"]`);

  it("asks for them when the Patients page is first opened, once, apart from the analysis", async () => {
    const { predicted, estimated } = await boot();
    expect(estimated()).toHaveLength(0);

    fireEvent.click(tab("Patients"));
    expect(screen.getByRole("status").textContent).toBe("Loading the models' estimates…");
    await waitFor(() => expect(estimate("sample-c")).toBeTruthy());

    expect(estimated()).toEqual(SAMPLES.map((sample) => sample.features));
    // Sample B is 71: the mocked model puts its LAD at 90%.
    expect(estimate("sample-a")!.textContent).toBe("81%CAD estimateLAD58%LCX22%RCA44%");
    expect(estimate("sample-b")!.textContent).toBe("81%CAD estimateLAD90%LCX22%RCA44%");
    expect(await screen.findByText(/^Ring and bars: the models' estimates for the patient\./)).toBeTruthy();
    expect(predicted()).toHaveLength(1);

    for (const page of ["Analysis", "Patients", "Home", "Patients"]) fireEvent.click(tab(page));
    expect(estimated()).toHaveLength(SAMPLES.length);
  });

  it("opens every patient even when the estimates cannot be loaded, and loads them on Retry", async () => {
    let failing = true;
    const { predicted, estimated } = await boot({
      "/api/predict": (init) =>
        failing && (init as { priority?: string }).priority === "low"
          ? jsonResponse({ error: { code: "INTERNAL_ERROR", message: "Something went wrong on the server." } }, 500)
          : mockedEstimate(init),
    });

    fireEvent.click(tab("Patients"));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The models' estimates could not be loaded.");
    expect(estimate("sample-a")).toBeNull();

    failing = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(estimate("sample-c")).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(estimated().length).toBeGreaterThan(SAMPLES.length);

    fireEvent.click(screen.getByRole("button", { name: /^Analyse Sample C,/ }));
    await waitFor(() => expect(predicted()).toHaveLength(2));
    expect(patientCard()).toContain("Sample C");
  });

  it("shows one group of patients when asked", async () => {
    await boot();
    fireEvent.click(tab("Patients"));

    fireEvent.click(screen.getByRole("button", { name: /^Dataset label: Normal · 1$/ }));

    expect(screen.getAllByRole("button", { name: /^Analyse Sample/ }).map((card) => card.getAttribute("aria-label"))).toEqual([
      "Analyse Sample C, 45 y · Female",
    ]);
  });
});
