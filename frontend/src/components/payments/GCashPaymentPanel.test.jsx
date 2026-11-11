import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GCashPaymentPanel from "./GCashPaymentPanel";

vi.mock("../../services/api", () => ({ default: { get: vi.fn() } }));
vi.mock("../../services/customerService", () => ({
  getGCashInstructions: vi.fn(),
  submitGCashProof: vi.fn(),
}));

import { getGCashInstructions } from "../../services/customerService";

describe("GCashPaymentPanel", () => {
  beforeEach(() => {
    getGCashInstructions.mockResolvedValue({
      booking_reference: "HS-42-reference",
      amount: 1250,
      merchant_name: null,
      qr_available: false,
    });
  });

  it("shows the authoritative amount and booking reference and requires a configured merchant QR", async () => {
    render(<GCashPaymentPanel bookingId={42} amount={1250} />);
    expect(await screen.findByText(/HS-42-reference/)).toBeTruthy();
    expect(screen.getByText(/PHP 1,250.00/)).toBeTruthy();
    expect(screen.queryByText(/does not encode your booking or amount/i)).toBeNull();
    expect(await screen.findByText(/official GCash QR has not been configured/i)).toBeTruthy();
    expect(screen.queryByLabelText("GCash transaction reference")).toBeNull();
    expect(screen.queryByRole("button", { name: "Submit for verification" })).toBeNull();
  });
});
