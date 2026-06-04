import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LLMModeToggle from "@/components/chat/LLMModeToggle";

describe("LLMModeToggle", () => {
  it("renders Local and Cloud buttons", () => {
    render(<LLMModeToggle mode="local" onChange={() => {}} />);
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("Cloud")).toBeInTheDocument();
  });

  it("calls onChange with 'cloud' when cloud button is clicked", () => {
    const onChange = vi.fn();
    render(<LLMModeToggle mode="local" onChange={onChange} />);
    fireEvent.click(screen.getByText("Cloud"));
    expect(onChange).toHaveBeenCalledWith("cloud");
  });

  it("calls onChange with 'local' when local button is clicked", () => {
    const onChange = vi.fn();
    render(<LLMModeToggle mode="cloud" onChange={onChange} />);
    fireEvent.click(screen.getByText("Local"));
    expect(onChange).toHaveBeenCalledWith("local");
  });

  it("disables both buttons when disabled prop is true", () => {
    render(<LLMModeToggle mode="local" onChange={() => {}} disabled />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("does not call onChange when disabled and clicked", () => {
    const onChange = vi.fn();
    render(<LLMModeToggle mode="local" onChange={onChange} disabled />);
    fireEvent.click(screen.getByText("Cloud"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
