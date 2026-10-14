import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SamplePatient } from "../../api/types";
import { riskColor } from "../../config/risk";
import { MetaContext } from "../../state/MetaContext";
import type { SampleEstimates, SampleEstimatesStatus } from "../../state/useSampleEstimates";
import { META, predictResponse, SAMPLES } from "../../test/fixtures";
import { PatientsView } from "./PatientsView";

function renderPage(samples: SamplePatient[] = SAMPLES, loadedSampleId: string | null = null, meta = META) {
  const onChoose = vi.fn();
  const onNewPatient = vi.fn();
  render(
    <MetaContext.Provider value={meta}>
      <PatientsView samples={samples} loadedSampleId={loadedSampleId} onChoose={onChoose} onNewPatient={onNewPatient} />
    </MetaContext.Provider>,
  );
  return { onChoose, onNewPatient };
}

const group = (name: RegExp) => screen.getByRole("region", { name });
const cardsIn = (name: RegExp) => within(group(name)).getAllByRole("button");
const card = (title: string) => screen.getByRole("button", { name: new RegExp(`^Analyse ${title},`) });

describe("Patients page (F1)", () => {
  it("says how many sample patients there are and that the models have never seen them", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Sample patients" })).toBeTruthy();
    expect(
      screen.getByText(
        "3 patients from the dataset that the models have never seen: they were set aside before training. Choose one to see what the models estimate for it.",
      ),
    ).toBeTruthy();
  });

  it("puts the patients in two groups by the dataset's overall label, in their order", () => {
    renderPage();

    expect(group(/^Dataset label: CAD/).textContent).toContain("Dataset label: CAD · 2 patients");
    expect(group(/^Dataset label: CAD/).textContent).toContain(
      "Angiography recorded a narrowing of 50% or more in at least one coronary artery.",
    );
    expect(cardsIn(/^Dataset label: CAD/).map((button) => button.getAttribute("aria-label"))).toEqual([
      "Analyse Sample A, 60 y · Male",
      "Analyse Sample B, 71 y · Female",
    ]);

    expect(group(/^Dataset label: Normal/).textContent).toContain("Dataset label: Normal · 1 patient");
    expect(group(/^Dataset label: Normal/).textContent).not.toContain("1 patients");
    expect(group(/^Dataset label: Normal/).textContent).toContain("Angiography recorded no such narrowing.");
    expect(cardsIn(/^Dataset label: Normal/).map((button) => button.getAttribute("aria-label"))).toEqual([
      "Analyse Sample C, 45 y · Female",
    ]);
  });

  it("leaves out a group that has no patient", () => {
    renderPage(SAMPLES.slice(0, 2));

    expect(screen.getAllByRole("region")).toHaveLength(1);
    expect(screen.queryByText(/^Dataset label: Normal/)).toBeNull();
  });

  it("shows on each card the inputs that matter most, without repeating age and sex", () => {
    renderPage();

    // The fixture's quick controls are typical chest pain, age, sex and ejection fraction.
    expect(card("Sample A").textContent).toBe("Sample A60 y · MaleTypical chest painYesEjection fraction55%Analyse →");
    expect(card("Sample B").textContent).toBe("Sample B71 y · FemaleTypical chest painYesEjection fraction40%Analyse →");
    expect(card("Sample C").textContent).toBe("Sample C45 y · FemaleTypical chest painNoEjection fraction55%Analyse →");
  });

  it("shows at most four inputs on a card", () => {
    renderPage(SAMPLES, null, { ...META, quick_controls: ["age", "dm", "cr", "bmi", "ef_tte", "bbb", "vhd"] });

    expect(card("Sample A").textContent).toBe(
      "Sample A60 y · MaleDiabetes mellitusYesCreatinine1.15 mg/dLBody mass index29.4 kg/m²Ejection fraction55%Analyse →",
    );
  });

  it("marks the sample that is in analysis, and only that one", () => {
    renderPage(SAMPLES, "sample-b");

    expect(card("Sample B").getAttribute("aria-current")).toBe("true");
    expect(card("Sample B").textContent).toContain("In analysis");
    expect(card("Sample A").getAttribute("aria-current")).toBeNull();
    expect(screen.getAllByText("In analysis")).toHaveLength(1);
  });

  it("marks no sample while a patient of the user's own is in analysis", () => {
    renderPage(SAMPLES, null);

    expect(screen.queryByText("In analysis")).toBeNull();
    expect(document.querySelector("[aria-current]")).toBeNull();
  });

  it("hands over the chosen sample, also the one already in analysis", () => {
    const { onChoose } = renderPage(SAMPLES, "sample-a");

    fireEvent.click(card("Sample C"));
    expect(onChoose).toHaveBeenLastCalledWith(SAMPLES[2]);
    fireEvent.click(card("Sample A"));
    expect(onChoose).toHaveBeenLastCalledWith(SAMPLES[0]);
    expect(onChoose).toHaveBeenCalledTimes(2);
  });

  it("offers the way to a patient of the user's own", () => {
    const { onNewPatient, onChoose } = renderPage();

    expect(screen.getByText("Not one of these? Enter a patient of your own.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New patient" }));
    expect(onNewPatient).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
  });
});

describe("Patients page: the models' estimates on the cards", () => {
  const ESTIMATES: SampleEstimates = {
    "sample-a": predictResponse(SAMPLES[0].features).predictions,
    "sample-c": predictResponse(SAMPLES[2].features, { cad: 0.07, lad: 0.2, lcx: 0.004, rca: 0.4999 }).predictions,
  };

  function renderWith(status: SampleEstimatesStatus, estimates: SampleEstimates = {}) {
    const onRetryEstimates = vi.fn();
    render(
      <MetaContext.Provider value={META}>
        <PatientsView
          samples={SAMPLES}
          loadedSampleId={null}
          estimates={estimates}
          estimatesStatus={status}
          onRetryEstimates={onRetryEstimates}
          onChoose={vi.fn()}
          onNewPatient={vi.fn()}
        />
      </MetaContext.Provider>,
    );
    return { onRetryEstimates };
  }
  const estimate = (id: string) => document.querySelector<HTMLElement>(`[data-estimate="${id}"]`);

  it("shows the overall estimate and the three vessels for a patient, in the app's percentages", () => {
    renderWith("ready", ESTIMATES);

    expect(estimate("sample-a")!.textContent).toBe("81%CAD estimateLAD58%LCX22%RCA44%");
    // The display rule of BR-14 holds here too: never 0%, and never 50% for an estimate below it.
    expect(estimate("sample-c")!.textContent).toBe("7%CAD estimateLAD20%LCX<1%RCA49%");
    expect(screen.getByText("Ring and bars: the models' estimates for the patient. Group: what angiography recorded.")).toBeTruthy();
  });

  it("draws ring and bars in the shared risk colours", () => {
    renderWith("ready", ESTIMATES);
    const ring = estimate("sample-a")!.querySelector("circle[stroke-dasharray]")!;
    const bars = Array.from(estimate("sample-a")!.querySelectorAll<HTMLElement>("[style*='width']"));
    const cssColor = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;

    expect(ring.getAttribute("stroke")).toBe(riskColor(0.8123));
    expect(ring.getAttribute("stroke-dasharray")).toBe("81 100");
    expect(bars.map((bar) => [bar.style.width, bar.style.backgroundColor])).toEqual([
      ["58%", cssColor(riskColor(0.581))],
      ["22%", cssColor(riskColor(0.2207))],
      ["44%", cssColor(riskColor(0.4402))],
    ]);
  });

  it("keeps the card's name and reads the estimates as its description", () => {
    renderWith("ready", ESTIMATES);

    expect(card("Sample A").getAttribute("aria-describedby")).toBe(estimate("sample-a")!.id);
    // A patient whose estimates have not arrived has nothing to describe it yet.
    expect(card("Sample B").getAttribute("aria-describedby")).toBeNull();
    expect(estimate("sample-b")).toBeNull();
  });

  it("says that the estimates are loading, and shows those that are already there", () => {
    renderWith("loading", { "sample-a": ESTIMATES["sample-a"] });

    expect(screen.getByRole("status").textContent).toBe("Loading the models' estimates…");
    expect(estimate("sample-a")).toBeTruthy();
    expect(card("Sample B").querySelector(".animate-pulse")).toBeTruthy();
    expect(card("Sample A").querySelector(".animate-pulse")).toBeNull();
  });

  it("says so when the estimates cannot be loaded, offers Retry, and still opens every patient", () => {
    const { onRetryEstimates } = renderWith("error");

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("The models' estimates could not be loaded. Every patient can still be opened.");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(onRetryEstimates).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button", { name: /^Analyse Sample/ })).toHaveLength(3);
  });
});

describe("Patients page: showing one group", () => {
  const filter = (name: RegExp) => within(screen.getByRole("group", { name: "Show" })).getByRole("button", { name });
  const shownCards = () => screen.getAllByRole("button", { name: /^Analyse Sample/ }).map((button) => button.getAttribute("aria-label")!.slice(8, 16));

  it("offers all patients and each dataset label, with their counts", () => {
    renderPage();

    expect(within(screen.getByRole("group", { name: "Show" })).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "All · 3", "Dataset label: CAD · 2", "Dataset label: Normal · 1",
    ]);
    expect(filter(/^All/).getAttribute("aria-pressed")).toBe("true");
    expect(shownCards()).toEqual(["Sample A", "Sample B", "Sample C"]);
  });

  it("shows only the chosen group, and all of them again", () => {
    renderPage();

    fireEvent.click(filter(/^Dataset label: Normal/));
    expect(shownCards()).toEqual(["Sample C"]);
    expect(filter(/^Dataset label: Normal/).getAttribute("aria-pressed")).toBe("true");
    expect(filter(/^All/).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getAllByRole("region")).toHaveLength(1);

    fireEvent.click(filter(/^Dataset label: CAD/));
    expect(shownCards()).toEqual(["Sample A", "Sample B"]);

    fireEvent.click(filter(/^All/));
    expect(shownCards()).toEqual(["Sample A", "Sample B", "Sample C"]);
  });

  it("offers no choice for a label that no patient has", () => {
    renderPage(SAMPLES.slice(0, 2));

    expect(screen.queryByRole("button", { name: /^Dataset label: Normal/ })).toBeNull();
    expect(filter(/^Dataset label: CAD/).textContent).toBe("Dataset label: CAD · 2");
  });
});
