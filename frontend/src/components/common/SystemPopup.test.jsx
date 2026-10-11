import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SystemPopup from "./SystemPopup";

describe("SystemPopup", () => {
  it("focuses the dialog, closes on Escape, and restores the previous focus", () => {
    const onClose = vi.fn();
    const { rerender } = render(<button type="button">Open message</button>);
    const trigger = screen.getByRole("button", { name: "Open message" });
    trigger.focus();
    rerender(
      <>
        <button type="button">Open message</button>
        <SystemPopup message="Please try again." onClose={onClose} />
      </>
    );

    const dialog = screen.getByRole("alertdialog");
    expect(document.activeElement).toBe(dialog);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
