import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ForecastChart from "./ForecastChart";

globalThis.ResizeObserver = class {
  constructor(callback) { this.callback = callback; }
  observe(target) { this.callback([{ target, contentRect: { width: 800, height: 288 } }]); }
  unobserve() {}
  disconnect() {}
};

Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
  configurable: true,
  value: () => ({ width: 800, height: 288, top: 0, left: 0, right: 800, bottom: 288 }),
});

describe("ForecastChart", () => {
  it("labels actual and predicted series accessibly", () => {
    render(
      <ForecastChart
        historical={[{ date: "2026-07-19", actual_demand: 2 }]}
        predictions={[{ date: "2026-07-21", predicted_demand: 3 }]}
      />,
    );

    const chart = screen.getByRole("img", { name: /historical actual demand and predicted demand chart/i });
    expect(chart).toBeTruthy();
    expect(screen.getByText("Actual completed appointments")).toBeTruthy();
    expect(screen.getByText("Predicted demand")).toBeTruthy();
  });
});
