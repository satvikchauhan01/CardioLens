import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Contribution } from "../../api/types";
import { FEATURES } from "../../test/fixtures";
import { ContributionBar } from "./ContributionBar";

afterEach(cleanup);

const AGE = FEATURES[0];

function show(contribution: Partial<Contribution>) {
  const full: Contribution = { feature: "age", value: 60, shap: 0, relative: 0, direction: "neutral", percentile: 80, ...contribution };
  render(
    <ul>
      <ContributionBar contribution={full} feature={AGE} scale={0.4} />
    </ul>,
  );
  return screen.getByRole("listitem").textContent;
}

describe("ContributionBar", () => {
  it("prints the signed share with the direction in words", () => {
    expect(show({ shap: 0.2, relative: 0.4, direction: "raises" })).toBe(
      "Age+40% (raises the estimate)60 years · 80th percentile",
    );
  });

  it("prints 0% only for an input that had no effect", () => {
    expect(show({})).toBe("Age0% (no effect on the estimate)60 years · 80th percentile");
  });

  it("prints <1% for an input whose share rounds to zero but which did move the estimate", () => {
    expect(show({ shap: -0.00002, relative: 0, direction: "lowers" })).toBe(
      "Age<1% (lowers the estimate)60 years · 80th percentile",
    );
  });
});

describe("ContributionBar: details while a row is pointed at or focused", () => {
  const BINARY = FEATURES[3]; // diabetes mellitus: no percentile, no range
  const EF = FEATURES[7]; // ejection fraction, in percent

  function row(feature = AGE, contribution: Partial<Contribution> = {}, units: "log_odds" | "probability" = "log_odds") {
    const full: Contribution = {
      feature: feature.id, value: 60, shap: 0.4123, relative: 0.4, direction: "raises", percentile: 80, ...contribution,
    };
    render(
      <ul>
        <ContributionBar contribution={full} feature={feature} scale={0.4} units={units} />
      </ul>,
    );
    return screen.getByRole("listitem", { name: "" });
  }
  const details = () => screen.queryByRole("tooltip");
  const lines = () => Array.from(details()!.querySelectorAll("p, li")).map((line) => line.textContent);

  it("shows nothing more until the row is pointed at, and hides it again", () => {
    const item = row();
    expect(details()).toBeNull();

    fireEvent.mouseEnter(item);
    expect(details()).toBeTruthy();
    expect(item.getAttribute("aria-describedby")).toBe(details()!.id);

    fireEvent.mouseLeave(item);
    expect(details()).toBeNull();
    expect(item.getAttribute("aria-describedby")).toBeNull();
  });

  it("opens for the keyboard as well, and closes on Escape", () => {
    const item = row();
    expect(item.tabIndex).toBe(0);

    fireEvent.focus(item);
    expect(details()).toBeTruthy();
    fireEvent.keyDown(item, { key: "Escape" });
    expect(details()).toBeNull();

    fireEvent.focus(item);
    fireEvent.blur(item);
    expect(details()).toBeNull();
  });

  it("spells out a numeric input: effect, share, SHAP value with its unit, percentile, range", () => {
    fireEvent.mouseEnter(row());

    expect(lines()).toEqual([
      "Age: 60 years",
      "Raised this estimate",
      "Share of the total contribution: +40%",
      "SHAP value: +0.412 (log-odds)",
      "80% of the training patients have a value at or below this one.",
      "Range seen in the dataset: 30 to 86 years",
    ]);
  });

  it("names the unit of a tree model's SHAP values, a lowering input and a range in percent", () => {
    fireEvent.mouseEnter(row(EF, { value: 55, shap: -0.0312, relative: -0.13, direction: "lowers", percentile: 98 }, "probability"));

    expect(lines()).toEqual([
      "Ejection fraction: 55%",
      "Lowered this estimate",
      "Share of the total contribution: −13%",
      "SHAP value: −0.031 (probability)",
      "98% of the training patients have a value at or below this one.",
      "Range seen in the dataset: 15 to 60%",
    ]);
  });

  it("leaves out what a yes/no input does not have, and says when an input moved nothing", () => {
    fireEvent.mouseEnter(row(BINARY, { value: true, shap: 0, relative: 0, direction: "neutral", percentile: null }));

    expect(lines()).toEqual([
      "Diabetes mellitus: Yes",
      "Did not move this estimate",
      "Share of the total contribution: 0%",
      "SHAP value: 0.000 (log-odds)",
    ]);
  });

  it("adds the input's description when the schema has one", () => {
    const described = { ...EF, description: "Measured by transthoracic echocardiography (TTE)." };
    fireEvent.mouseEnter(row(described, { value: 55 }));

    expect(lines().at(-1)).toBe("Measured by transthoracic echocardiography (TTE).");
  });
});
