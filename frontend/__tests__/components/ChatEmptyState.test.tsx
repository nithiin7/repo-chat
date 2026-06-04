import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChatEmptyState from "@/components/chat/ChatEmptyState";
import type { Repo } from "@/types";

vi.mock("framer-motion");

const mockRepo: Repo = {
  repo_id: "repo-1",
  name: "my-project",
  url: "https://github.com/user/my-project",
  indexed_at: "2024-01-01T00:00:00Z",
  file_count: 1234,
};

describe("ChatEmptyState", () => {
  it("renders the 'Generate onboarding doc' button", () => {
    render(<ChatEmptyState repo={null} mode="local" onSuggestionClick={() => {}} />);
    expect(screen.getByText("Generate onboarding doc")).toBeInTheDocument();
  });

  it("renders the four suggestion chips", () => {
    render(<ChatEmptyState repo={null} mode="local" onSuggestionClick={() => {}} />);
    expect(screen.getByText("What does this codebase do?")).toBeInTheDocument();
    expect(screen.getByText("What are the main entry points?")).toBeInTheDocument();
    expect(screen.getByText("How is authentication handled?")).toBeInTheDocument();
    expect(screen.getByText("Explain the folder structure")).toBeInTheDocument();
  });

  it("shows file count and local LLM label when repo is provided", () => {
    render(<ChatEmptyState repo={mockRepo} mode="local" onSuggestionClick={() => {}} />);
    expect(screen.getByText(/1,234 files indexed/)).toBeInTheDocument();
    expect(screen.getByText(/local LLM/)).toBeInTheDocument();
  });

  it("shows cloud LLM label when mode is cloud", () => {
    render(<ChatEmptyState repo={mockRepo} mode="cloud" onSuggestionClick={() => {}} />);
    expect(screen.getByText(/cloud LLM/)).toBeInTheDocument();
  });

  it("shows fallback text when no repo is provided", () => {
    render(<ChatEmptyState repo={null} mode="local" onSuggestionClick={() => {}} />);
    expect(screen.getByText("Repository is indexed and ready")).toBeInTheDocument();
  });

  it("calls onSuggestionClick with the correct text when a suggestion is clicked", () => {
    const onSuggestionClick = vi.fn();
    render(<ChatEmptyState repo={null} mode="local" onSuggestionClick={onSuggestionClick} />);
    fireEvent.click(screen.getByText("What does this codebase do?"));
    expect(onSuggestionClick).toHaveBeenCalledWith("What does this codebase do?");
  });

  it("calls onSuggestionClick with the onboarding prompt when that button is clicked", () => {
    const onSuggestionClick = vi.fn();
    render(<ChatEmptyState repo={null} mode="local" onSuggestionClick={onSuggestionClick} />);
    fireEvent.click(screen.getByText("Generate onboarding doc"));
    expect(onSuggestionClick).toHaveBeenCalledWith(expect.stringContaining("onboarding guide"));
  });
});
