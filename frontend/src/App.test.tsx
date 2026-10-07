import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { jsonResponse, META, predictResponse, SAMPLES } from "./test/fixtures";

// Copied from PRODUCT_SPEC §9.1 on purpose, so a change to the constant alone fails this test.
const DISCLAIMER_TEXT =
  "Educational and decision-support prototype. Estimates come from a model trained on a small public research dataset (303 patients). They are not a diagnosis and not a substitute for clinical evaluation or diagnostic imaging such as coronary angiography.";

type Route = (init?: RequestInit) => Response | Promise<Response>;

/** A working backend; pass routes to replace an endpoint. */
function mockApi(routes: Record<string, Route> = {}) {
  const defaults: Record<string, Route> = {
    "/api/meta": () => jsonResponse(META),
    "/api/samples": () => jsonResponse({ samples: SAMPLES }),
    "/api/predict": (init) => jsonResponse(predictResponse(JSON.parse(init?.body as string).features)),
  };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ({ ...defaults, ...routes })[url](init));
  vi.stubGlobal("fetch", fetchMock);
  const calls = (url: string) => fetchMock.mock.calls.filter(([called]) => called === url);
  return { fetchMock, calls };
}

const tab = (name: string) => screen.getByRole("tab", { name });
const isSelected = (name: string) => tab(name).getAttribute("aria-selected") === "true";
const disclaimer = () => screen.getByRole("note", { name: "Disclaimer" }).textContent;

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
    const { calls } = mockApi();
    render(<App />);
    expect(screen.getByRole("status", { name: "Loading the model service…" })).toBeTruthy();

    const cad = await screen.findByRole("button", { name: /Coronary artery disease/ });
    expect(cad.textContent).toContain("81%");
    expect(cad.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Sample A/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("region", { name: "Why this estimate: CAD" })).toBeTruthy();
    expect(screen.getByText(/Model version 20261007T1423Z-7393432/)).toBeTruthy();

    expect(calls("/api/predict")).toHaveLength(1);
    expect(JSON.parse(calls("/api/predict")[0][1]?.body as string)).toEqual({ features: SAMPLES[0].features });
  });

  it("explains how to start the backend when it cannot be reached, and recovers on Retry", async () => {
    let reachable = false;
    const unreachable = () => {
      if (!reachable) throw new TypeError("Failed to fetch");
      return jsonResponse(META);
    };
    mockApi({ "/api/meta": unreachable });
    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Can't reach the CardioLens model service.");
    expect(alert.textContent).toContain("uvicorn app.main:app --port 8000");
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

describe("Patient analysis flow", () => {
  it("predicts again when another patient is loaded", async () => {
    const { calls } = mockApi();
    render(<App />);
    await screen.findByRole("button", { name: /Coronary artery disease/ });

    fireEvent.click(screen.getByRole("button", { name: /Sample B/ }));

    await waitFor(() => expect(calls("/api/predict")).toHaveLength(2));
    expect(JSON.parse(calls("/api/predict")[1][1]?.body as string)).toEqual({ features: SAMPLES[1].features });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Sample B/ }).getAttribute("aria-pressed")).toBe("true"),
    );
    expect((screen.getByLabelText(/^Age/) as HTMLInputElement).value).toBe("71");
  });

  it("shows the selected vessel's explanation without a new request", async () => {
    const { calls } = mockApi();
    render(<App />);
    await screen.findByRole("button", { name: /Coronary artery disease/ });

    fireEvent.click(screen.getByRole("button", { name: /^LCX/ }));

    expect(screen.getByRole("region", { name: "Why this estimate: LCX" }).textContent).toContain("Summary for lcx.");
    expect(calls("/api/predict")).toHaveLength(1);
  });

  it("keeps the loaded patient when switching tabs", async () => {
    const { calls } = mockApi();
    render(<App />);
    await screen.findByRole("button", { name: /Coronary artery disease/ });
    fireEvent.click(screen.getByRole("button", { name: /^LAD/ }));

    fireEvent.click(tab("Model & method"));
    fireEvent.click(tab("Patient analysis"));

    expect(screen.getByRole("button", { name: /^LAD/ }).getAttribute("aria-pressed")).toBe("true");
    expect(calls("/api/predict")).toHaveLength(1);
  });

  it("shows a prediction failure with Retry and recovers", async () => {
    let failing = true;
    const { calls } = mockApi({
      "/api/predict": (init) =>
        failing
          ? jsonResponse({ error: { code: "INTERNAL_ERROR", message: "Something went wrong on the server." } }, 500)
          : jsonResponse(predictResponse(JSON.parse(init?.body as string).features)),
    });
    render(<App />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The estimates could not be updated.");
    expect(alert.textContent).toContain("Something went wrong on the server.");

    failing = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: /Coronary artery disease/ })).toBeTruthy();
    expect(calls("/api/predict")).toHaveLength(2);
  });
});
