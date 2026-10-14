import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MetaContext } from "../../state/MetaContext";
import { FEATURES, META, SAMPLES } from "../../test/fixtures";
import { NewPatientView } from "./NewPatientView";

const TYPICAL = Object.fromEntries(FEATURES.map((feature) => [feature.id, feature.default]));

function renderPage(meta = META) {
  const onAnalyse = vi.fn();
  render(
    <MetaContext.Provider value={meta}>
      <NewPatientView samples={SAMPLES} onAnalyse={onAnalyse} />
    </MetaContext.Provider>,
  );
  return { onAnalyse };
}

const input = (label: RegExp | string) => screen.getByLabelText(label) as HTMLInputElement;
const startFrom = () => screen.getByLabelText("Start from") as HTMLSelectElement;
const analyse = () => screen.getByRole("button", { name: "Analyse this patient" }) as HTMLButtonElement;
const change = (label: RegExp | string, value: string) => fireEvent.change(input(label), { target: { value } });

describe("New patient page (F2)", () => {
  it("says what to enter and starts every field from its typical value", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "New patient" })).toBeTruthy();
    expect(
      screen.getByText(
        "Enter the 9 clinical inputs of a patient of your own. Every field starts from a typical value: the training median or most common value of that input.",
      ),
    ).toBeTruthy();
    expect(startFrom().value).toBe("typical");
    expect(input(/^Age/).value).toBe("58");
    expect(input(/^Body mass index/).value).toBe("26.8");
    expect(input(/^Sex/).value).toBe("Male");
    expect(input(/^Typical chest pain/).checked).toBe(true);
    expect(input(/^Diabetes mellitus/).checked).toBe(false);
    expect(input(/^Valvular heart disease/).value).toBe("Mild");
  });

  it("shows every input once, in one card per clinical group", () => {
    renderPage();

    const groups = screen.getAllByRole("group").map((element) => element.getAttribute("aria-label"));
    expect(groups).toEqual(META.feature_groups.map((group) => group.label));
    const inGroup = (name: string) =>
      Array.from(screen.getByRole("group", { name }).querySelectorAll("input, select")).map((field) => field.id);
    // Numbers and choices first, then the yes/no switches.
    expect(inGroup("Demographics & history")).toEqual(["new-age", "new-sex", "new-bmi", "new-dm"]);
    expect(inGroup("Symptoms & examination")).toEqual(["new-typical_chest_pain"]);
    expect(inGroup("Echocardiography")).toEqual(["new-ef_tte", "new-vhd"]);
    expect(document.querySelectorAll("[id^='new-']:is(input, select)")).toHaveLength(FEATURES.length);
  });

  it("offers typical values and every sample patient as a starting point", () => {
    renderPage();

    expect(Array.from(startFrom().options).map((option) => option.textContent)).toEqual([
      "Typical values",
      "Sample A (60 y · Male)",
      "Sample B (71 y · Female)",
      "Sample C (45 y · Female)",
    ]);
  });

  it("fills the form from a sample patient and back from typical values", () => {
    renderPage();
    change(/^Age/, "80");

    fireEvent.change(startFrom(), { target: { value: "sample-b" } });
    expect(input(/^Age/).value).toBe("71");
    expect(input(/^Sex/).value).toBe("Female");
    expect(input(/^Ejection fraction/).value).toBe("40");
    expect(input(/^Creatinine/).value).toBe("1.15");

    fireEvent.change(startFrom(), { target: { value: "typical" } });
    expect(input(/^Age/).value).toBe("58");
    expect(input(/^Sex/).value).toBe("Male");
    expect(input(/^Ejection fraction/).value).toBe("50");
  });

  it("hands over the entered values, and only when asked", () => {
    const { onAnalyse } = renderPage();

    change(/^Age/, "72");
    fireEvent.change(input(/^Sex/), { target: { value: "Female" } });
    fireEvent.click(input(/^Diabetes mellitus/));
    change(/^Creatinine/, "1.4");
    expect(onAnalyse).not.toHaveBeenCalled();

    fireEvent.click(analyse());
    expect(onAnalyse).toHaveBeenCalledTimes(1);
    expect(onAnalyse).toHaveBeenLastCalledWith({ ...TYPICAL, age: 72, sex: "Female", dm: true, cr: 1.4 });
  });

  it("hands over a sample's values unchanged when the form was started from it", () => {
    const { onAnalyse } = renderPage();

    fireEvent.change(startFrom(), { target: { value: "sample-c" } });
    fireEvent.click(analyse());

    expect(onAnalyse).toHaveBeenLastCalledWith(SAMPLES[2].features);
  });

  it("names a value outside the dataset's range and does not analyse it", () => {
    const { onAnalyse } = renderPage();
    expect(screen.queryByRole("alert")).toBeNull();

    change(/^Age/, "200");

    expect(input(/^Age/).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Must be between 30 and 86 (range seen in the dataset).")).toBeTruthy();
    expect(analyse().disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe("1 field needs attention before the patient can be analysed.");
    // Pressing Enter in a field submits the form as well.
    fireEvent.submit(analyse().closest("form")!);
    expect(onAnalyse).not.toHaveBeenCalled();

    change(/^Age/, "86");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(analyse().disabled).toBe(false);
    fireEvent.click(analyse());
    expect(onAnalyse).toHaveBeenLastCalledWith({ ...TYPICAL, age: 86 });
  });

  it("counts every field that needs attention: empty, fractional, out of range", () => {
    const { onAnalyse } = renderPage();

    change(/^Age/, "");
    change(/^Ejection fraction/, "40.5");
    change(/^Creatinine/, "9");

    const demographics = within(screen.getByRole("group", { name: "Demographics & history" }));
    expect(demographics.getByText("This value is required.")).toBeTruthy();
    expect(screen.getByText("Must be a whole number.")).toBeTruthy();
    expect(screen.getByText("Must be between 0.5 and 2.2 (range seen in the dataset).")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("3 fields need attention before the patient can be analysed.");
    expect(analyse().disabled).toBe(true);
    expect(onAnalyse).not.toHaveBeenCalled();
  });

  it("points out a combination the dataset does not contain, and still analyses it (BR-15)", () => {
    // The fixture's schema, with a second type of chest pain.
    const atypical = { ...FEATURES[4], id: "atypical", source_column: "Atypical", label: "Atypical chest pain", default: false };
    const { onAnalyse } = renderPage({ ...META, features: [...FEATURES, atypical] });
    expect(screen.queryByText("Unusual combination")).toBeNull();

    fireEvent.click(input(/^Atypical chest pain/));

    expect(screen.getByRole("status").textContent).toBe(
      "Unusual combination" +
        "Typical chest pain and Atypical chest pain are both set to yes. No patient in the dataset has more than one type of chest pain." +
        "Estimates for such a combination go beyond the data the models were trained on.",
    );
    expect(analyse().disabled).toBe(false);
    fireEvent.click(analyse());
    expect(onAnalyse).toHaveBeenLastCalledWith({ ...TYPICAL, atypical: true });
  });
});
