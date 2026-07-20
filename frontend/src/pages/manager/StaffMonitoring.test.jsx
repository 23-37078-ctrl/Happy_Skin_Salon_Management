import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StaffMonitoring from "./StaffMonitoring";
import forecastService from "../../services/forecastService";

globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ currentUser: { id: 2, role: "manager", branch_id: 1, full_name: "Manager" }, logout: vi.fn() }),
}));

vi.mock("../../services/forecastService", () => ({
  default: { branchForecast: vi.fn() },
}));

const forecast = {
  branch_id: 1,
  branch_name: "Main Branch",
  forecast_period: "2026-07-21 to 2026-07-27",
  model: "28-day moving average fallback",
  generated_at: "2026-07-20T12:00:00+08:00",
  data_quality: "insufficient",
  limitation: "Historical data is insufficient for validated ML forecasting.",
  readiness: { completed_appointments: 1, history_days: 20 },
  historical: [{ date: "2026-07-19", actual_demand: 0 }],
  predictions: [{ date: "2026-07-21", predicted_demand: 0, demand_level: "low", recommendation: "Continue monitoring." }],
};

function renderPage() {
  return render(<MemoryRouter><StaffMonitoring /></MemoryRouter>);
}

describe("StaffMonitoring", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the branch forecast and limitation", async () => {
    forecastService.branchForecast.mockResolvedValue(forecast);
    renderPage();

    expect(await screen.findByText("Main Branch")).toBeTruthy();
    expect(screen.getByText(/insufficient for validated ML forecasting/i)).toBeTruthy();
    expect(screen.getByText(/Continue monitoring/i)).toBeTruthy();
  });

  it("renders an API error state", async () => {
    forecastService.branchForecast.mockRejectedValue({ response: { data: { detail: "Forecast unavailable." } } });
    renderPage();

    expect(await screen.findByText("Forecast unavailable.")).toBeTruthy();
  });
});
