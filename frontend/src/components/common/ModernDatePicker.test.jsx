import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ModernDatePicker from "./ModernDatePicker";

describe("ModernDatePicker", () => {
  it("clears a selected date with a separate accessible control", () => {
    const onChange = vi.fn();
    render(<ModernDatePicker value="2026-10-11" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Clear date" }));

    expect(onChange).toHaveBeenCalledWith("");
    expect(screen.getAllByRole("button").every((button) => !button.closest("button button"))).toBe(true);
  });
});
