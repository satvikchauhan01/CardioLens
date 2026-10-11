import { cleanup, render, screen } from "@testing-library/react";
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
