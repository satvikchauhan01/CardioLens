import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { initialAnalysisState, type AnalysisState } from "../../state/analysisReducer";
import { MetaContext } from "../../state/MetaContext";
import type { Analysis } from "../../state/useAnalysis";
import { FEATURES, META, SAMPLES } from "../../test/fixtures";
import { PatientPanel } from "./PatientPanel";

const A = SAMPLES[0];
const B = SAMPLES[1];

function loaded(overrides: Partial<AnalysisState> = {}): AnalysisState {
  return {
    ...initialAnalysisState, status: "ready", source: "sample", sampleId: A.id,
    loadedValues: A.features, values: A.features, ...overrides,
  };
}

function renderPanel(state: AnalysisState) {
  const analysis: Analysis = {
    state, loadSample: vi.fn(), loadTypical: vi.fn(), edit: vi.fn(), retry: vi.fn(), resetToOriginal: vi.fn(),
  };
  const ui = (next: AnalysisState) => (
    <MetaContext.Provider value={META}>
      <PatientPanel samples={SAMPLES} analysis={{ ...analysis, state: next }} />
    </MetaContext.Provider>
  );
  const view = render(ui(state));
  return { analysis, rerender: (next: AnalysisState) => view.rerender(ui(next)) };
}

// The same input can appear twice: in the quick controls and in the full form.
const form = () => within(screen.getByRole("group", { name: "All clinical inputs" }));
const quick = () => within(screen.getByRole("group", { name: "Quick what-if controls" }));
const input = (label: RegExp | string) => form().getByLabelText(label) as HTMLInputElement;

describe("patient panel (F1, F2)", () => {
  it("lists the sample patients and typical values, with a hint before anything is loaded", () => {
    const { analysis } = renderPanel(initialAnalysisState);

    const samples = within(screen.getByRole("group", { name: "Sample patients" })).getAllByRole("button");
    expect(samples.map((button) => button.textContent)).toEqual(["Sample A60 y · Male", "Sample B71 y · Female"]);
    expect(samples.every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(screen.getByText("Choose a sample patient or start from typical values.")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Quick what-if controls" })).toBeNull();

    fireEvent.click(samples[1]);
    expect(analysis.loadSample).toHaveBeenCalledExactlyOnceWith(B);
    fireEvent.click(screen.getByRole("button", { name: "Start from typical values" }));
    expect(analysis.loadTypical).toHaveBeenCalledOnce();
  });

  it("marks the loaded sample and shows that it was held out", () => {
    const { rerender } = renderPanel(loaded());

    expect(screen.getByRole("button", { name: /Sample A/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Sample B/ }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Held out — not used for training or validation.")).toBeTruthy();

    rerender(loaded({ source: "typical", sampleId: null }));
    expect(screen.getByRole("button", { name: /Sample A/ }).getAttribute("aria-pressed")).toBe("false");
    expect(
      screen.getByRole("button", { name: "Start from typical values" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("builds one section per group and one field per input from the schema", () => {
    renderPanel(loaded());

    const sections = Array.from(document.querySelectorAll("details"));
    expect(sections.map((section) => section.querySelector("summary")?.textContent)).toEqual([
      "Demographics & history4 inputs", "Symptoms & examination1 inputs", "ECG findings1 inputs",
      "Laboratory1 inputs", "Echocardiography2 inputs",
    ]);
    expect(sections[0].open).toBe(true);
    expect(sections[1].open).toBe(false);
    for (const feature of FEATURES) {
      expect(form().getByLabelText(new RegExp(`^${feature.label}`))).toBeTruthy();
    }
  });

  it("shows each value in a control that fits its type", () => {
    renderPanel(loaded());

    expect(input(/^Age/).type).toBe("number");
    expect(input(/^Age/).value).toBe("60");
    expect(input(/^Body mass index/).value).toBe("29.4");
    expect(input(/^Creatinine/).value).toBe("1.15");
    expect(form().getByText("30–86")).toBeTruthy();
    expect(form().getByText("18.2–40.9")).toBeTruthy();
    expect(form().getByRole("switch", { name: /Diabetes mellitus/ })).toHaveProperty("checked", true);
    expect((form().getByLabelText("Sex") as HTMLSelectElement).value).toBe("Male");
    expect(
      Array.from((form().getByLabelText("Valvular heart disease") as HTMLSelectElement).options).map((o) => o.value),
    ).toEqual(["None", "Mild", "Moderate", "Severe"]);
  });

  it("reports edits as typed values", () => {
    const { analysis } = renderPanel(loaded());

    fireEvent.change(input(/^Age/), { target: { value: "61" } });
    expect(analysis.edit).toHaveBeenLastCalledWith("age", 61);
    fireEvent.change(input(/^Body mass index/), { target: { value: "30.5" } });
    expect(analysis.edit).toHaveBeenLastCalledWith("bmi", 30.5);
    fireEvent.change(input(/^Age/), { target: { value: "" } });
    expect(analysis.edit).toHaveBeenLastCalledWith("age", null);
    fireEvent.click(form().getByRole("switch", { name: /Diabetes mellitus/ }));
    expect(analysis.edit).toHaveBeenLastCalledWith("dm", false);
    fireEvent.change(form().getByLabelText("Bundle branch block"), { target: { value: "LBBB" } });
    expect(analysis.edit).toHaveBeenLastCalledWith("bbb", "LBBB");
  });

  it("keeps what is being typed and follows values loaded from outside", () => {
    const { rerender } = renderPanel(loaded());

    fireEvent.change(input(/^Body mass index/), { target: { value: "30.50" } });
    rerender(loaded({ values: { ...A.features, bmi: 30.5 } }));
    expect(input(/^Body mass index/).value).toBe("30.50");

    rerender(loaded({ sampleId: B.id, loadedValues: B.features, values: B.features }));
    expect(input(/^Age/).value).toBe("71");
    expect(input(/^Body mass index/).value).toBe("29.4");
    expect(form().getByRole("switch", { name: /Diabetes mellitus/ })).toHaveProperty("checked", false);
    expect((form().getByLabelText("Sex") as HTMLSelectElement).value).toBe("Female");
  });

  it("shows field errors, links them to the field and opens their section", () => {
    const message = "Must be between 15 and 60 (range seen in the dataset).";
    renderPanel(loaded({ status: "input_invalid", values: { ...A.features, ef_tte: 90 }, fieldErrors: { ef_tte: message } }));

    const field = input(/^Ejection fraction/);
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(field.getAttribute("aria-describedby")!)?.textContent).toBe(message);

    const section = field.closest("details")!;
    expect(section.open).toBe(true);
    expect(section.querySelector("summary")?.textContent).toBe("Echocardiography1 needs attention");
    expect(input(/^Age/).getAttribute("aria-invalid")).toBeNull();
    // The quick control for the same input shows the error too.
    expect(quick().getByLabelText(/^Ejection fraction \(/).getAttribute("aria-invalid")).toBe("true");
  });
});

describe("what-if explorer (F7)", () => {
  const slider = (name: string) => quick().getByRole("slider", { name: `${name} slider` }) as HTMLInputElement;

  it("offers the quick controls in the API's order, each fitting its type (BR-9)", () => {
    renderPanel(loaded());

    expect(quick().getByRole("switch", { name: /Typical chest pain/ })).toHaveProperty("checked", true);
    expect((quick().getByLabelText(/^Age \(/) as HTMLInputElement).value).toBe("60");
    expect([slider("Age").min, slider("Age").max, slider("Age").step, slider("Age").value]).toEqual(["30", "86", "1", "60"]);
    expect(slider("Ejection fraction").value).toBe("55");
    expect(quick().getAllByRole("radio").map((radio) => (radio as HTMLInputElement).value)).toEqual(["Male", "Female"]);
    expect(quick().getByRole("radio", { name: "Male" })).toHaveProperty("checked", true);

    const order = Array.from(
      screen.getByRole("group", { name: "Quick what-if controls" }).querySelectorAll("label[for], legend"),
    ).map((element) => element.textContent);
    expect(order).toEqual(["Typical chest painYes", "Age (years)", "Sex", "Ejection fraction (%)"]);
  });

  it("reports changes from the slider, the switch and the segmented control", () => {
    const { analysis } = renderPanel(loaded());

    fireEvent.change(slider("Age"), { target: { value: "72" } });
    expect(analysis.edit).toHaveBeenLastCalledWith("age", 72);
    fireEvent.change(quick().getByLabelText(/^Age \(/), { target: { value: "45" } });
    expect(analysis.edit).toHaveBeenLastCalledWith("age", 45);
    fireEvent.click(quick().getByRole("switch", { name: /Typical chest pain/ }));
    expect(analysis.edit).toHaveBeenLastCalledWith("typical_chest_pain", false);
    fireEvent.click(quick().getByRole("radio", { name: "Female" }));
    expect(analysis.edit).toHaveBeenLastCalledWith("sex", "Female");
  });

  it("keeps the quick control, its slider and the full form on the same value", () => {
    const { rerender } = renderPanel(loaded());

    rerender(loaded({ values: { ...A.features, age: 72, sex: "Female" } }));

    expect(slider("Age").value).toBe("72");
    expect((quick().getByLabelText(/^Age \(/) as HTMLInputElement).value).toBe("72");
    expect(input(/^Age/).value).toBe("72");
    expect(quick().getByRole("radio", { name: "Female" })).toHaveProperty("checked", true);
    expect((form().getByLabelText("Sex") as HTMLSelectElement).value).toBe("Female");
  });

  it("keeps the slider inside its range while the number field holds something else", () => {
    renderPanel(loaded({ values: { ...A.features, age: 200, ef_tte: null } }));

    expect(slider("Age").value).toBe("86");
    expect(slider("Ejection fraction").value).toBe("15");
  });

  it("shows how many fields are modified and offers Reset to original (BR-10)", () => {
    const { analysis, rerender } = renderPanel(loaded());
    expect(screen.queryByText(/^Modified/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Reset to original" })).toBeNull();

    rerender(loaded({ values: { ...A.features, age: 72 } }));
    expect(screen.getByText("Modified (1 field)")).toBeTruthy();

    rerender(loaded({ values: { ...A.features, age: 72, dm: false, sex: "Female" } }));
    expect(screen.getByText("Modified (3 fields)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Reset to original" }));
    expect(analysis.resetToOriginal).toHaveBeenCalledOnce();
  });

  it("states what a what-if change does and does not show", () => {
    renderPanel(loaded());

    // PRODUCT_SPEC §9.5, copied on purpose.
    expect(
      screen.getByText(
        "What-if shows how the model's estimate responds to changed inputs. It does not predict the effect of treatment.",
      ),
    ).toBeTruthy();
  });
});
