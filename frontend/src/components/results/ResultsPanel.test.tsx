import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import type { PredictResponse, TargetId } from "../../api/types";
import { riskColor } from "../../config/risk";
import { initialAnalysisState, type AnalysisState } from "../../state/analysisReducer";
import { MetaContext } from "../../state/MetaContext";
import { META, predictResponse, SAMPLES } from "../../test/fixtures";
import { ResultsPanel } from "./ResultsPanel";

const VALUES = SAMPLES[0].features;

function ready(result: PredictResponse): AnalysisState {
  return {
    ...initialAnalysisState, status: "ready", source: "sample", sampleId: "sample-a",
    loadedValues: VALUES, values: VALUES, result, originalResult: result, lastGoodResult: result,
    latestRequestId: 1, loadRequestId: 1,
  };
}

function renderPanel(state: AnalysisState, selectedTarget: TargetId = "cad") {
  const onSelectTarget = vi.fn();
  const onRetry = vi.fn();
  const view = render(
    <MetaContext.Provider value={META}>
      <ResultsPanel state={state} selectedTarget={selectedTarget} onSelectTarget={onSelectTarget} onRetry={onRetry} />
    </MetaContext.Provider>,
  );
  const rerender = (next: AnalysisState, target: TargetId = selectedTarget) =>
    view.rerender(
      <MetaContext.Provider value={META}>
        <ResultsPanel state={next} selectedTarget={target} onSelectTarget={onSelectTarget} onRetry={onRetry} />
      </MetaContext.Provider>,
    );
  return { onSelectTarget, onRetry, rerender };
}

const row = (name: RegExp) => screen.getByRole("button", { name });

describe("results panel (F4)", () => {
  it("shows the CAD estimate and each vessel with percentage, status and level", () => {
    renderPanel(ready(predictResponse()));

    const cad = row(/Coronary artery disease/);
    expect(cad.textContent).toContain("81%");
    expect(cad.textContent).toContain("CAD predicted");
    expect(cad.textContent).toContain("High");

    const vessels = within(screen.getByRole("list", { name: "Coronary arteries" }));
    expect(vessels.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "LAD · Left Anterior Descending58%Stenosis predictedModerate",
      "LCX · Left Circumflex22%Stenosis not predictedLow",
      "RCA · Right Coronary Artery44%Stenosis not predictedModerate",
    ]);
    expect(screen.getByText("Model estimate — not a diagnosis.")).toBeTruthy();
    expect(screen.getByText("Model-estimated probability, not a clinical risk category.")).toBeTruthy();
  });

  it("uses the status and level the API sends, including exactly at the thresholds", () => {
    renderPanel(ready(predictResponse(VALUES, { cad: 0.5, lad: 0.4999, lcx: 0.35, rca: 0.65 })));

    expect(row(/Coronary artery disease/).textContent).toContain("50%");
    expect(row(/Coronary artery disease/).textContent).toContain("CAD predicted");
    expect(row(/^LAD/).textContent).toBe("LAD · Left Anterior Descending50%Stenosis not predictedModerate");
    expect(row(/^LCX/).textContent).toBe("LCX · Left Circumflex35%Stenosis not predictedModerate");
    expect(row(/^RCA/).textContent).toBe("RCA · Right Coronary Artery65%Stenosis predictedHigh");
  });

  it("says CAD not predicted below the threshold", () => {
    renderPanel(ready(predictResponse(VALUES, { cad: 0.2, lad: 0.1 })));

    expect(row(/Coronary artery disease/).textContent).toContain("CAD not predicted");
    expect(row(/Coronary artery disease/).textContent).toContain("Low");
  });

  it("shows the agreement note only when the models disagree", () => {
    const { rerender } = renderPanel(ready(predictResponse()));
    expect(screen.queryByRole("note")).toBeNull();

    rerender(ready(predictResponse(VALUES, { cad: 0.91, lad: 0.48, lcx: 0.29, rca: 0.08 })));
    expect(screen.getByRole("note").textContent).toBe(
      "The overall CAD model and the three vessel models are trained separately, so they can disagree. Here, CAD is predicted but no single vessel reaches 50%.",
    );

    rerender(ready(predictResponse(VALUES, { cad: 0.3, lad: 0.7 })));
    expect(screen.getByRole("note").textContent).toContain(
      "a vessel reaches 50% but overall CAD is not predicted",
    );
  });

  it("marks the selected target and reports clicks on the card and the rows", () => {
    const { onSelectTarget, rerender } = renderPanel(ready(predictResponse()));
    expect(row(/Coronary artery disease/).getAttribute("aria-pressed")).toBe("true");
    expect(row(/^LAD/).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(row(/^LCX/));
    expect(onSelectTarget).toHaveBeenLastCalledWith("lcx");

    rerender(ready(predictResponse()), "lcx");
    expect(row(/^LCX/).getAttribute("aria-pressed")).toBe("true");
    expect(row(/Coronary artery disease/).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(row(/Coronary artery disease/));
    expect(onSelectTarget).toHaveBeenLastCalledWith("cad");
  });

  it("colours each bar from the shared risk scale and fills it to the estimate", () => {
    renderPanel(ready(predictResponse()));
    const bar = (target: string) => document.querySelector<HTMLElement>(`[data-risk-bar="${target}"]`)!;
    const cssColor = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;

    expect(bar("cad").style.backgroundColor).toBe(cssColor(riskColor(0.8123)));
    expect(bar("lad").style.backgroundColor).toBe(cssColor(riskColor(0.581)));
    expect(bar("lcx").style.width).toBe("22%");
    expect(bar("rca").style.width).toBe("44%");
  });

  it("reports hover and focus on a row, and highlights the row hovered in the viewer", () => {
    const onHoverTarget = vi.fn();
    render(
      <MetaContext.Provider value={META}>
        <ResultsPanel
          state={ready(predictResponse())}
          selectedTarget="cad"
          hoveredTarget="rca"
          onSelectTarget={vi.fn()}
          onHoverTarget={onHoverTarget}
          onRetry={vi.fn()}
        />
      </MetaContext.Provider>,
    );

    fireEvent.mouseEnter(row(/^LAD/));
    expect(onHoverTarget).toHaveBeenLastCalledWith("lad");
    fireEvent.mouseLeave(row(/^LAD/));
    expect(onHoverTarget).toHaveBeenLastCalledWith(null);
    fireEvent.focus(row(/^LCX/));
    expect(onHoverTarget).toHaveBeenLastCalledWith("lcx");
    fireEvent.blur(row(/^LCX/));
    expect(onHoverTarget).toHaveBeenLastCalledWith(null);
    expect(row(/^RCA/).className.split(" ")).toContain("border-brand");
    expect(row(/^LAD/).className.split(" ")).not.toContain("border-brand");
  });

  it("shows a hint when no patient is loaded", () => {
    renderPanel(initialAnalysisState);

    expect(screen.getByText("Choose a sample patient or start from typical values.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a loading state for the first prediction", () => {
    renderPanel({ ...initialAnalysisState, status: "predicting", values: VALUES, latestRequestId: 1 });

    expect(screen.getByRole("status").textContent).toBe("Updating…");
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("keeps the previous result, dimmed, while a new prediction is pending", () => {
    const result = predictResponse();
    renderPanel({ ...ready(result), status: "predicting", result: null });

    expect(screen.getByRole("status").textContent).toBe("Updating…");
    expect(row(/Coronary artery disease/).textContent).toContain("81%");
    expect(document.querySelector('[aria-busy="true"]')?.className).toContain("opacity-60");
  });

  it("labels the last good result as out of date when the inputs are invalid", () => {
    renderPanel({
      ...ready(predictResponse()), status: "input_invalid", result: null,
      fieldErrors: { age: "This value is required." },
    });

    expect(screen.getByText("Out of date — fix highlighted fields")).toBeTruthy();
    expect(row(/Coronary artery disease/).textContent).toContain("81%");
  });

  it("shows the error with Retry and keeps the last good result as out of date", () => {
    const error = new ApiError("NETWORK_ERROR", "The model service could not be reached.");
    const { onRetry } = renderPanel({ ...ready(predictResponse()), status: "error", result: null, error });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("The estimates could not be updated.");
    expect(alert.textContent).toContain("The model service could not be reached.");
    expect(screen.getByText("Out of date")).toBeTruthy();
    expect(row(/Coronary artery disease/).textContent).toContain("81%");

    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows only the error when the very first prediction fails", () => {
    const error = new ApiError("INTERNAL_ERROR", "Something went wrong on the server.");
    renderPanel({ ...initialAnalysisState, status: "error", values: VALUES, error });

    expect(screen.getByRole("alert").textContent).toContain("Something went wrong on the server.");
    expect(screen.queryByText(/%/)).toBeNull();
  });
});

describe("what-if deltas (BR-10)", () => {
  const original = predictResponse();
  const edited = { ...VALUES, age: 72 };
  const delta = (target: string) => document.querySelector(`[data-delta="${target}"]`)?.textContent ?? null;
  const modified = (result: PredictResponse): AnalysisState => ({
    ...ready(original), values: edited, result, lastGoodResult: result, latestRequestId: 2,
  });

  it("shows no change while the inputs are those of the loaded patient", () => {
    renderPanel(ready(original));

    expect(document.querySelector("[data-delta]")).toBeNull();
  });

  it("shows original → current and the signed difference for every target once the inputs differ", () => {
    renderPanel(modified(predictResponse(edited, { cad: 0.9051, lad: 0.436, lcx: 0.2207, rca: 0.9975 })));

    expect(delta("cad")).toBe("81% → 91%, +10 pp");
    expect(delta("lad")).toBe("58% → 44%, −14 pp");
    expect(delta("lcx")).toBe("22% → 22%, 0 pp");
    expect(delta("rca")).toBe("44% → >99%, +56 pp");
    // The row itself shows the current estimate.
    expect(row(/^LAD/).textContent).toBe(
      "LAD · Left Anterior Descending44%Stenosis not predictedModerate58% → 44%, −14 pp",
    );
  });

  it("waits for the new estimate before showing a change", () => {
    renderPanel({ ...ready(original), status: "predicting", values: edited, result: null, latestRequestId: 2 });

    expect(row(/^LAD/).textContent).toContain("58%");
    expect(document.querySelector("[data-delta]")).toBeNull();
  });

  it("keeps the last change, dimmed, while a further edit is pending", () => {
    const first = predictResponse(edited, { lad: 0.9 });
    renderPanel({ ...modified(first), status: "predicting", values: { ...edited, age: 75 }, result: null, latestRequestId: 3 });

    expect(delta("lad")).toBe("58% → 90%, +32 pp");
    expect(document.querySelector('[aria-busy="true"]')?.className).toContain("opacity-60");
  });

  it("shows no change when the original values were typed back", () => {
    const again = predictResponse();
    renderPanel({ ...ready(original), result: again, lastGoodResult: again, latestRequestId: 3 });

    expect(document.querySelector("[data-delta]")).toBeNull();
  });
});

describe("ground-truth reveal (F8, BR-11)", () => {
  type Labels = Record<TargetId, 0 | 1>;
  const POSITIVE: Labels = SAMPLES[0].ground_truth;
  const truth = (target: string) => document.querySelector(`[data-truth="${target}"]`)?.textContent ?? null;
  const toggle = () =>
    screen.getByRole("checkbox", { name: "Show dataset angiography result" }) as HTMLInputElement;
  const note = () => document.getElementById(toggle().getAttribute("aria-describedby")!)?.textContent;

  function renderReveal(state: AnalysisState, groundTruth: Labels | null, show: boolean) {
    const onShowGroundTruth = vi.fn();
    render(
      <MetaContext.Provider value={META}>
        <ResultsPanel
          state={state}
          selectedTarget="cad"
          onSelectTarget={vi.fn()}
          onRetry={vi.fn()}
          groundTruth={groundTruth}
          showGroundTruth={show}
          onShowGroundTruth={onShowGroundTruth}
        />
      </MetaContext.Provider>,
    );
    return { onShowGroundTruth };
  }

  it("offers the toggle for an unmodified sample and reports the choice", () => {
    const { onShowGroundTruth } = renderReveal(ready(predictResponse()), POSITIVE, false);

    expect(toggle().disabled).toBe(false);
    expect(toggle().checked).toBe(false);
    expect(note()).toBe(
      "This sample patient was held out from training and validation. The dataset label is what angiography recorded.",
    );
    expect(document.querySelector("[data-truth]")).toBeNull();

    fireEvent.click(toggle());
    expect(onShowGroundTruth).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("shows the dataset label of every target", () => {
    // The fixture predicts CAD and LAD; sample A's four labels are all positive.
    renderReveal(ready(predictResponse()), POSITIVE, true);

    expect(toggle().checked).toBe(true);
    expect(truth("cad")).toBe("Dataset label: CAD ✓ (matches the model's prediction)");
    expect(truth("lad")).toBe("Dataset label: Stenotic ✓ (matches the model's prediction)");
    expect(truth("lcx")).toBe("Dataset label: Stenotic ✗ (differs from the model's prediction)");
    expect(truth("rca")).toBe("Dataset label: Stenotic ✗ (differs from the model's prediction)");
    expect(screen.getByText("The model's prediction matches the dataset label for 2 of 4 targets.")).toBeTruthy();
  });

  it("marks a match from the predicted status, for positive and negative labels alike (BR-3)", () => {
    renderReveal(
      ready(predictResponse(VALUES, { cad: 0.2, lad: 0.7, lcx: 0.5, rca: 0.4999 })),
      { cad: 0, lad: 0, lcx: 1, rca: 1 },
      true,
    );

    expect(truth("cad")).toBe("Dataset label: Normal ✓ (matches the model's prediction)");
    expect(truth("lad")).toBe("Dataset label: Normal ✗ (differs from the model's prediction)");
    expect(truth("lcx")).toBe("Dataset label: Stenotic ✓ (matches the model's prediction)");
    expect(truth("rca")).toBe("Dataset label: Stenotic ✗ (differs from the model's prediction)");
  });

  it("counts the targets that match", () => {
    renderReveal(ready(predictResponse(VALUES, { cad: 0.9, lad: 0.8, lcx: 0.7, rca: 0.6 })), POSITIVE, true);

    expect(screen.getByText("The model's prediction matches the dataset label for 4 of 4 targets.")).toBeTruthy();
  });

  it("hides the labels and explains why once the inputs are modified", () => {
    const edited = { ...VALUES, age: 72 };
    const result = predictResponse(edited);
    renderReveal(
      { ...ready(predictResponse()), values: edited, result, lastGoodResult: result, latestRequestId: 2 },
      POSITIVE,
      true,
    );

    const reason =
      "Hidden while inputs are modified: the dataset label belongs to the original patient. Use “Reset to original” to compare again.";
    expect(document.querySelector("[data-truth]")).toBeNull();
    expect(screen.queryByText(/matches the dataset label for/)).toBeNull();
    expect(toggle().disabled).toBe(true);
    expect(toggle().checked).toBe(false);
    expect(note()).toBe(reason);
    expect(toggle().closest("label")?.title).toBe(reason);
  });

  it("has nothing to reveal for a patient that is not a sample", () => {
    renderReveal({ ...ready(predictResponse()), source: "typical", sampleId: null }, null, true);

    expect(document.querySelector("[data-truth]")).toBeNull();
    expect(toggle().disabled).toBe(true);
    expect(note()).toBe("Only sample patients have a dataset label to compare with.");
  });

  it("keeps the labels back until the estimates on screen are the sample's own", () => {
    // Another sample is loading: the dimmed result still belongs to the previous patient.
    renderReveal({ ...ready(predictResponse()), status: "predicting", result: null, latestRequestId: 2 }, POSITIVE, true);

    expect(document.querySelector("[data-truth]")).toBeNull();
    expect(toggle().disabled).toBe(false);
    expect(toggle().checked).toBe(true);
  });

  it("shows no toggle where the reveal is not wired", () => {
    renderPanel(ready(predictResponse()));

    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});

describe("explanation panel (F6)", () => {
  const labels = () =>
    within(screen.getByRole("region", { name: /Why this estimate/ }))
      .getAllByRole("listitem")
      .map((item) => item.querySelector("span")?.textContent);

  it("explains the selected target with the model's own contributions", () => {
    renderPanel(ready(predictResponse()), "lad");

    const panel = screen.getByRole("region", { name: "Why this estimate: LAD" });
    expect(panel.textContent).toContain("Random forest · SHAP contributions");
    expect(panel.textContent).toContain("Summary for lad.");
    expect(labels()[0]).toBe("Ejection fraction");
  });

  it("keeps the API's order, shows the top 8 and expands to all", () => {
    renderPanel(ready(predictResponse()), "cad");

    expect(labels()).toEqual([
      "Typical chest pain", "Age", "Sex", "Body mass index", "Diabetes mellitus",
      "Bundle branch block", "Creatinine", "Ejection fraction",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Show all 9" }));
    expect(labels()).toHaveLength(9);
    expect(labels()[8]).toBe("Valvular heart disease");

    fireEvent.click(screen.getByRole("button", { name: "Show top 8" }));
    expect(labels()).toHaveLength(8);
  });

  it("prints each contribution with its measurement, percentile and signed share", () => {
    renderPanel(ready(predictResponse()), "cad");
    const items = within(screen.getByRole("region", { name: /Why this estimate/ })).getAllByRole("listitem");
    const text = items.map((item) => item.textContent);

    expect(text[0]).toBe("Typical chest pain+40% (raises the estimate)Yes");
    expect(text[1]).toBe("Age−25% (lowers the estimate)60 years · 80th percentile");
    expect(text[3]).toBe("Body mass index+10% (raises the estimate)29.4 kg/m² · 78th percentile");
    expect(text[6]).toBe("Creatinine+2% (raises the estimate)1.15 mg/dL · 75th percentile");
    // 0.4% of the total rounds to nothing, so it is shown as "<1%".
    expect(text[7]).toBe("Ejection fraction<1% (lowers the estimate)55% · 74th percentile");

    fireEvent.click(screen.getByRole("button", { name: "Show all 9" }));
    const last = within(screen.getByRole("region", { name: /Why this estimate/ })).getAllByRole("listitem")[8];
    expect(last.textContent).toBe("Valvular heart disease0% (no effect on the estimate)Mild");
  });

  it("switches with the selected target", () => {
    const { rerender } = renderPanel(ready(predictResponse()), "cad");
    expect(labels()[0]).toBe("Typical chest pain");

    rerender(ready(predictResponse()), "lcx");
    expect(screen.getByRole("region", { name: "Why this estimate: LCX" })).toBeTruthy();
    expect(labels()[0]).toBe("Creatinine");

    rerender(ready(predictResponse()), "rca");
    expect(screen.getByRole("region", { name: "Why this estimate: RCA" }).textContent).toContain(
      "Logistic regression · SHAP contributions",
    );
    expect(labels()[0]).toBe("Diabetes mellitus");
  });
});
