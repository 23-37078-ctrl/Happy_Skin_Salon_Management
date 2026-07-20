import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ForcastingPage from "./ForcastingPage";
import forecastService from "../../services/forecastService";
import ownerService from "../../services/ownerService";

globalThis.ResizeObserver = class {
  constructor(callback) { this.callback = callback; }
  observe(target) { this.callback([{ target, contentRect: { width: 800, height: 320 } }]); }
  unobserve() {}
  disconnect() {}
};

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { id: 1, role: "owner", full_name: "Owner" }, logout: vi.fn() }),
}));

vi.mock("../../services/forecastService", () => ({
  default: { branchForecast: vi.fn(), train: vi.fn() },
}));

vi.mock("../../services/ownerService", () => ({
  default: { branches: vi.fn() },
}));

function makeForecast(branchId, branchName) {
  return {
    branch_id: branchId,
    branch_name: branchName,
    forecast_period: "2026-07-22 to 2026-07-28",
    model: "28-day moving average fallback",
    generated_at: "2026-07-21T08:00:00+08:00",
    data_quality: "insufficient",
    limitation: "Historical data is insufficient for validated ML forecasting.",
    readiness: { history_days: 20, completed_appointments: 1, nonzero_days: 1 },
    historical: [{ date: "2026-07-20", actual_demand: 1 }],
    predictions: [{ date: "2026-07-22", predicted_demand: 1, demand_level: "low", recommendation: "Continue monitoring confirmed appointments." }],
  };
}

describe("Owner demand forecasting workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ownerService.branches.mockResolvedValue({ branches: [{ id: 1, is_active: true }, { id: 2, is_active: true }] });
    forecastService.branchForecast.mockImplementation((branchId) => Promise.resolve(makeForecast(branchId, branchId === 1 ? "Main Branch" : "North Branch")));
  });

  it("renders executive metrics and switches the selected branch", async () => {
    render(<MemoryRouter><ForcastingPage /></MemoryRouter>);

    expect(await screen.findByText("Forecast workspace")).toBeTruthy();
    expect(screen.getByText("Model readiness")).toBeTruthy();
    expect(screen.getByText("Daily operational outlook")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Branch"), { target: { value: "2" } });
    expect(screen.getByRole("heading", { name: "North Branch" })).toBeTruthy();
  });
});
