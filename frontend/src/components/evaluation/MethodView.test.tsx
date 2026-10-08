import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MetricsResponse } from "../../api/types";
import { MetaContext } from "../../state/MetaContext";
import { jsonResponse, META, METRICS } from "../../test/fixtures";
import { MethodView } from "./MethodView";

// Copied from PRODUCT_SPEC §9.4 on purpose, so a change to the constant alone fails this test.
const LIMITATIONS_TEXT = [
  "Trained on 303 patients from one public research dataset; performance on other populations is unknown.",
  "Inputs are recorded clinical findings, not raw ECG, echo or imaging data.",
  "Vessel predictions are per artery; the dataset contains no location of narrowing within an artery.",
  "Cross-validated metrics have wide uncertainty at this sample size (shown as ± std).",
  "What-if changes show model sensitivity, not the effect of any treatment.",
];

function mockMetrics(respond: () => Response | Promise<Response> = () => jsonResponse(METRICS)) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => respond());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderView(active = true) {
  const ui = (isActive: boolean) => (
    <MetaContext.Provider value={META}>
      <MethodView active={isActive} />
    </MetaContext.Provider>
  );
  const view = render(ui(active));
  return { setActive: (next: boolean) => view.rerender(ui(next)) };
}

async function loaded(metrics: MetricsResponse = METRICS) {
  const fetchMock = mockMetrics(() => jsonResponse(metrics));
  const view = renderView();
  await screen.findByRole("heading", { name: "Method" });
  return { fetchMock, ...view };
}

const section = (title: string) => within(screen.getByRole("heading", { name: title }).closest("section")!);
const methodRows = () =>
  Object.fromEntries(
    Array.from(document.querySelectorAll("dt")).map((term) => [term.textContent, term.nextElementSibling?.textContent]),
  );
const rowHeaders = (table: HTMLElement) =>
  within(table).getAllByRole("rowheader").map((header) => header.textContent);
const cells = (table: HTMLElement, name: RegExp) =>
  within(within(table).getByRole("row", { name })).getAllByRole("cell").map((cell) => cell.textContent);
const candidates = (target: string) => document.querySelector<HTMLElement>(`table[data-candidates="${target}"]`)!;
const plots = () => screen.getAllByRole("img").map((image) => [image.getAttribute("src"), image.getAttribute("alt")]);
const targetButton = (name: string) => section("Results by target").getByRole("button", { name });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Model & method view (F9)", () => {
  it("asks for the metrics the first time it is shown, and only once (DF-4)", async () => {
    const fetchMock = mockMetrics();
    const { setActive } = renderView(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();

    setActive(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/metrics");
    expect(screen.getByRole("status").textContent).toBe("Loading the evaluation results…");

    await screen.findByRole("heading", { name: "Method" });
    expect(screen.queryByRole("status")).toBeNull();
    setActive(false);
    setActive(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("describes the method from the validation the API reports (§4.3 section 1)", async () => {
    await loaded();

    expect(methodRows()).toEqual({
      Dataset: "extention of Z-Alizadeh sani dataset: 303 patients (CC BY 4.0).",
      "Held-out sample patients":
        "6 sample patients were held out by a fixed rule (seed 42) before any training; they are not used for cross-validation or the final fit.",
      "Training rows": "297 patients, used for cross-validation and for the final fit.",
      Validation:
        "Repeated stratified 5-fold cross-validation, 5 repeats (25 folds, seed 42). Preprocessing is refitted inside every fold.",
      "Leakage guard": "These dataset columns are never inputs to any model: LAD, LCX, RCA, Cath.",
      "Decision threshold": "0.5: a target is predicted when its probability is at or above it.",
      "Model selection":
        "The candidate with the highest mean ROC-AUC is selected; logistic regression is preferred when it is within 0.01 of the best. No hyperparameters are tuned.",
      "Model version": "20261007T1423Z-7393432, trained 2026-10-07 14:23:00 UTC.",
    });
  });

  it("follows the numbers of the validation it is given", async () => {
    await loaded({
      ...METRICS,
      validation: {
        ...METRICS.validation, n_splits: 4, n_repeats: 3, seed: 7, n_rows: 250, decision_threshold: 0.4,
        preprocessing_inside_folds: false, excluded_columns: ["Cath"],
      },
    });

    expect(methodRows()).toMatchObject({
      "Training rows": "250 patients, used for cross-validation and for the final fit.",
      Validation: "Repeated stratified 4-fold cross-validation, 3 repeats (12 folds, seed 7).",
      "Leakage guard": "These dataset columns are never inputs to any model: Cath.",
      "Decision threshold": "0.4: a target is predicted when its probability is at or above it.",
    });
    expect(screen.getByRole("img", { name: /^Confusion matrix/ }).getAttribute("alt")).toBe(
      "Confusion matrix of the Logistic regression model for CAD at threshold 0.4",
    );
  });

  it("lists the selected model of every target with each metric as mean ± std (section 2)", async () => {
    await loaded();
    const overview = section("Selected models").getByRole("table");

    expect(within(overview).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Target", "Selected model", "Positive / negative", "ROC-AUC", "Accuracy", "Precision", "Recall",
      "Specificity", "F1", "Average precision", "Brier score",
    ]);
    expect(rowHeaders(overview)).toEqual(["CAD", "LAD", "LCX", "RCA"]);
    expect(cells(overview, /^CAD/)).toEqual([
      "Logistic regression", "212 / 85", "0.917 ± 0.031", "0.857 ± 0.031", "0.897 ± 0.031", "0.887 ± 0.031",
      "0.767 ± 0.031", "0.897 ± 0.031", "0.957 ± 0.031", "0.083 ± 0.031",
    ]);
    expect(cells(overview, /^LAD/).slice(0, 3)).toEqual(["Random forest", "174 / 123", "0.855 ± 0.031"]);
    expect(cells(overview, /^LCX/).slice(0, 3)).toEqual(["Random forest", "116 / 181", "0.739 ± 0.031"]);
    expect(cells(overview, /^RCA/).slice(0, 3)).toEqual(["Logistic regression", "113 / 184", "0.725 ± 0.031"]);
    // The caption names the table and says what the numbers are.
    expect(
      section("Selected models").getByRole("table", { name: /mean ± standard deviation over the folds/ }),
    ).toBe(overview);
  });

  it("shows every candidate and the baseline for one target, the selected model marked (section 2)", async () => {
    await loaded();
    const table = candidates("cad");

    expect(rowHeaders(table)).toEqual([
      "Logistic regression · selected", "Random forest", "Gradient boosting", "Baseline (class prior)",
    ]);
    expect(cells(table, /^Logistic regression/)[0]).toBe("0.917 ± 0.031");
    expect(cells(table, /^Random forest/)[0]).toBe("0.907 ± 0.031");
    expect(cells(table, /^Gradient boosting/)[0]).toBe("0.887 ± 0.031");
    expect(cells(table, /^Baseline/)[0]).toBe("0.500 ± 0.000");
    expect(within(table).getByRole("row", { name: /^Logistic regression/ }).className).toBe("bg-brand-soft");
    expect(within(table).getByRole("row", { name: /^Random forest/ }).className).toBe("");
    expect(section("Results by target").getByText(/212 positive and 85 negative/).textContent).toBe(
      "CAD · Coronary artery disease. 212 positive and 85 negative training patients (71.4% positive). Selected model: Logistic regression. Within 0.01 of best; simplest model preferred.",
    );
  });

  it("shows the three out-of-fold plots of the target with text alternatives (section 3)", async () => {
    await loaded();

    expect(plots()).toEqual([
      ["/static/plots/cad_roc.png", "ROC curves for CAD: the three candidate models on out-of-fold predictions"],
      [
        "/static/plots/cad_calibration.png",
        "Calibration of the Logistic regression model for CAD: observed fraction against mean predicted probability",
      ],
      ["/static/plots/cad_confusion.png", "Confusion matrix of the Logistic regression model for CAD at threshold 0.5"],
    ]);
  });

  it("lists the top inputs by their share of the global importance (section 4)", async () => {
    await loaded();
    const importance = screen.getByRole("heading", { name: "Global feature importance" }).parentElement!;

    expect(within(importance).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Typical chest pain15.1%", "Ejection fraction8.6%", "Age6.9%",
    ]);
    // Bars are relative to the largest share.
    const widths = Array.from(importance.querySelectorAll<HTMLElement>("li span[aria-hidden] > span")).map(
      (bar) => Math.round(parseFloat(bar.style.width)),
    );
    expect(widths).toEqual([100, 57, 46]);
  });

  it("names an input the schema does not know by its id", async () => {
    const cad = { ...METRICS.targets.cad, global_importance: [{ feature: "not_in_schema", share: 0.2 }] };
    await loaded({ ...METRICS, targets: { ...METRICS.targets, cad } });

    expect(screen.getByText("not_in_schema")).toBeTruthy();
  });

  it("switches the detailed target", async () => {
    await loaded();
    expect(targetButton("CAD").getAttribute("aria-pressed")).toBe("true");
    expect(targetButton("LAD").getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(targetButton("LAD"));

    expect(targetButton("LAD").getAttribute("aria-pressed")).toBe("true");
    expect(targetButton("CAD").getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector('table[data-candidates="cad"]')).toBeNull();
    expect(rowHeaders(candidates("lad"))).toEqual([
      "Logistic regression", "Random forest · selected", "Gradient boosting", "Baseline (class prior)",
    ]);
    expect(plots().map(([src]) => src)).toEqual([
      "/static/plots/lad_roc.png", "/static/plots/lad_calibration.png", "/static/plots/lad_confusion.png",
    ]);
    expect(plots()[1][1]).toBe(
      "Calibration of the Random forest model for LAD: observed fraction against mean predicted probability",
    );
    expect(section("Results by target").getByText(/174 positive and 123 negative/).textContent).toContain(
      "Selected model: Random forest. Highest mean ROC-AUC.",
    );
  });

  it("states the limitations exactly as specified (section 5)", async () => {
    await loaded();

    expect(section("Limitations").getAllByRole("listitem").map((item) => item.textContent)).toEqual(LIMITATIONS_TEXT);
  });

  it("credits the dataset, the heart model and the libraries (section 6)", async () => {
    await loaded();
    const credits = section("Credits");

    expect(credits.getByText(/^Dataset:/).textContent).toBe(
      "Dataset: Alizadehsani, R., Roshanzamir, M., & Sani, Z. (2013). Licensed under CC BY 4.0. UCI dataset page",
    );
    expect(credits.getByRole("link", { name: "UCI dataset page" }).getAttribute("href")).toBe(META.dataset.url);
    expect(
      credits.getByText(
        "3D heart and coronary arteries: built from the BodyParts3D anatomy parts. Full credit and licence to be added.",
      ),
    ).toBeTruthy();
    expect(
      credits.getByText("Built with scikit-learn, SHAP, FastAPI, React, three.js and React Three Fiber."),
    ).toBeTruthy();
  });

  it("shows the service's message with Retry when the metrics cannot be loaded, and recovers", async () => {
    let failing = true;
    const fetchMock = mockMetrics(() =>
      failing
        ? jsonResponse({ error: { code: "MODEL_UNAVAILABLE", message: "Artifacts are not loaded." } }, 503)
        : jsonResponse(METRICS),
    );
    const { setActive } = renderView();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The evaluation results could not be loaded.");
    expect(alert.textContent).toContain("Artifacts are not loaded.");
    expect(screen.queryByRole("table")).toBeNull();

    // Coming back to the tab does not ask again by itself.
    setActive(false);
    setActive(true);
    expect(fetchMock).toHaveBeenCalledOnce();

    failing = false;
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(screen.getByRole("status").textContent).toBe("Loading the evaluation results…");
    expect(await screen.findByRole("heading", { name: "Method" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("says so when the service cannot be reached", async () => {
    mockMetrics(() => {
      throw new TypeError("Failed to fetch");
    });
    renderView();

    expect((await screen.findByRole("alert")).textContent).toContain("The model service could not be reached.");
  });
});
