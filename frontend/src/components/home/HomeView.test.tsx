import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { initialAnalysisState, type AnalysisState } from "../../state/analysisReducer";
import { MetaContext } from "../../state/MetaContext";
import { META, predictResponse, SAMPLES } from "../../test/fixtures";
import { HomeView } from "./HomeView";

const A = SAMPLES[0];

const analysed = (overrides: Partial<AnalysisState> = {}): AnalysisState => ({
  ...initialAnalysisState, status: "ready", source: "sample", sampleId: A.id,
  loadedValues: A.features, values: A.features, result: predictResponse(), ...overrides,
});

function renderHome(state: AnalysisState = analysed()) {
  const onNavigate = vi.fn();
  const onStartTour = vi.fn();
  render(
    <MetaContext.Provider value={META}>
      <HomeView samples={SAMPLES} state={state} active onNavigate={onNavigate} onStartTour={onStartTour} />
    </MetaContext.Provider>,
  );
  return { onNavigate, onStartTour };
}

describe("Home page", () => {
  it("says what the app is, with the prototype note above it", () => {
    renderHome();

    expect(screen.getByRole("heading", { name: "See which coronary artery a model is concerned about, and why." })).toBeTruthy();
    expect(screen.getByText("Educational decision-support prototype")).toBeTruthy();
    expect(
      screen.getByText(
        "CardioLens turns a patient's routine clinical findings into four model estimates, shows each one on the artery it belongs to, and explains it with the patient's own measurements.",
      ),
    ).toBeTruthy();
  });

  it("gives the app's numbers as the model service reports them", () => {
    renderHome();
    const numbers = within(screen.getByRole("region", { name: "CardioLens in numbers" }));

    // The fixture: four targets, nine inputs, three sample patients, 303 patients.
    expect(numbers.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "models", "clinical inputs", "sample patients", "patients in the dataset",
    ]);
    expect(numbers.getAllByRole("definition").map((value) => value.firstChild!.textContent)).toEqual(["4", "9", "3", "303"]);
    expect(numbers.getByText("Set aside before training, so the models have never seen them.")).toBeTruthy();
  });

  it("leads to the analysis and starts the tour", () => {
    const { onNavigate, onStartTour } = renderHome();

    fireEvent.click(screen.getByRole("button", { name: "Open the analysis" }));
    expect(onNavigate).toHaveBeenLastCalledWith("analysis");

    fireEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    expect(onStartTour).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("offers the three other pages, counting the sample patients by their dataset label", () => {
    const { onNavigate } = renderHome();
    const ways = within(screen.getByRole("region", { name: "Where to start" }));

    expect(
      ways.getByText(
        "3 patients from the dataset: 2 with the dataset label CAD and 1 with Normal. See what the models estimate for each.",
      ),
    ).toBeTruthy();
    expect(ways.getByText(/^All 9 inputs, starting from typical values\./)).toBeTruthy();

    const buttons = ways.getAllByRole("button");
    expect(buttons.map((button) => button.textContent!.split(/(?<=[a-z])(?=[A-Z0-9])/)[0])).toEqual([
      "Explore the sample patients", "Enter a patient of your own", "See how it was validated",
    ]);
    buttons.forEach((button) => fireEvent.click(button));
    expect(onNavigate.mock.calls.map(([tab]) => tab)).toEqual(["patients", "new", "method"]);
  });

  it("lists how the app is used, in order", () => {
    renderHome();
    const steps = within(screen.getByRole("region", { name: "How it works" })).getAllByRole("listitem");

    expect(steps.map((step) => step.textContent)).toEqual([
      "1Choose a patientA sample patient from the dataset, or values of your own.",
      "2Read the heartEach artery takes the colour of its estimated probability of a narrowing of 50% or more.",
      "3Ask whySelect an artery to see which measurements raised or lowered its estimate.",
      "4Try a what-ifChange an input and see how the model's estimates respond.",
    ]);
  });

  it("names the patient whose estimates colour the heart", () => {
    renderHome();
    expect(screen.getByText("Sample A: each artery is coloured by its model estimate. Drag to turn the heart.")).toBeTruthy();
  });

  it("names a patient of the user's own as such", () => {
    renderHome(analysed({ source: "custom", sampleId: null }));
    expect(screen.getByText(/^Your patient: each artery is coloured by its model estimate\./)).toBeTruthy();
  });

  it("says that the estimates are on their way before there are any", () => {
    renderHome(initialAnalysisState);

    expect(screen.getByText("The first estimates are on their way.")).toBeTruthy();
    expect(screen.queryByText(/each artery is coloured/)).toBeNull();
  });

  it("shows a plain mark instead of the 3D heart where 3D graphics are missing", () => {
    renderHome();

    // This test environment has no WebGL: no picture is announced, and nothing can be operated.
    expect(screen.queryByRole("img")).toBeNull();
    expect(document.querySelector("figure [aria-hidden='true'] svg")).toBeTruthy();
  });
});
