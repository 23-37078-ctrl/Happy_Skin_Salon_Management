import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";
import PaymentMethodPicker from "./PaymentMethodPicker";

function CheckoutChoice() {
  const [selected, setSelected] = useState("gcash");
  return <PaymentMethodPicker selected={selected} onSelect={setSelected} />;
}

describe("PaymentMethodPicker", () => {
  it("defaults to GCash and lets the customer switch to PayPal", () => {
    render(<CheckoutChoice />);
    const gcash = screen.getByRole("button", { name: "GCash" });
    const paypal = screen.getByRole("button", { name: "PayPal" });
    expect(gcash.getAttribute("aria-pressed")).toBe("true");
    expect(paypal.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(paypal);
    expect(paypal.getAttribute("aria-pressed")).toBe("true");
    expect(gcash.getAttribute("aria-pressed")).toBe("false");
  });
});
