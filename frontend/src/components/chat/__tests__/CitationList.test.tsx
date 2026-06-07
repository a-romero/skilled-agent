import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CitationList } from "../CitationList";

describe("CitationList", () => {
  let eventListener: EventListener;

  beforeEach(() => {
    eventListener = vi.fn();
    window.addEventListener("open-knowledge-file", eventListener);
  });

  afterEach(() => {
    window.removeEventListener("open-knowledge-file", eventListener);
  });

  it("renders null when sources array is empty", () => {
    const { container } = render(<CitationList sources={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders null when sources is undefined", () => {
    // @ts-expect-error Testing runtime behavior
    const { container } = render(<CitationList sources={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders sources heading when sources exist", () => {
    render(<CitationList sources={["knowledge/file1.md"]} />);
    expect(screen.getByText("Sources")).toBeInTheDocument();
  });

  it("renders single source correctly", () => {
    render(<CitationList sources={["knowledge/claims/file1.md"]} />);
    
    expect(screen.getByText("file1.md")).toBeInTheDocument();
    expect(screen.getByText("knowledge/claims/file1.md")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders multiple sources with correct numbering", () => {
    const sources = [
      "knowledge/file1.md",
      "knowledge/file2.md",
      "knowledge/file3.md",
    ];
    
    render(<CitationList sources={sources} />);
    
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("file1.md")).toBeInTheDocument();
    expect(screen.getByText("file2.md")).toBeInTheDocument();
    expect(screen.getByText("file3.md")).toBeInTheDocument();
  });

  it("extracts filename from nested path", () => {
    render(<CitationList sources={["deep/nested/path/to/file.md"]} />);
    expect(screen.getByText("file.md")).toBeInTheDocument();
  });

  it("handles path with no slashes", () => {
    render(<CitationList sources={["file.md"]} />);
    // file.md appears twice (title and path), use getAllByText
    const elements = screen.getAllByText("file.md");
    expect(elements).toHaveLength(2);
  });

  it("dispatches custom event when source clicked", () => {
    render(<CitationList sources={["knowledge/test.md"]} />);
    
    const sourceItem = screen.getByText("test.md").closest(".source-item");
    expect(sourceItem).toBeInTheDocument();
    
    fireEvent.click(sourceItem!);
    
    expect(eventListener).toHaveBeenCalledTimes(1);
    const event = (eventListener as any).mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ path: "knowledge/test.md" });
  });

  it("dispatches correct path for each source", () => {
    const sources = ["file1.md", "file2.md"];
    render(<CitationList sources={sources} />);
    
    // Get source items by their container class
    const sourceItems = document.querySelectorAll(".source-item");
    
    fireEvent.click(sourceItems[0]);
    let event = (eventListener as any).mock.calls[0][0] as CustomEvent;
    expect(event.detail.path).toBe("file1.md");
    
    fireEvent.click(sourceItems[1]);
    event = (eventListener as any).mock.calls[1][0] as CustomEvent;
    expect(event.detail.path).toBe("file2.md");
  });

  it("handles sources with special characters", () => {
    const sources = ["file with spaces.md", "file-with-dashes.md", "file_with_underscores.md"];
    render(<CitationList sources={sources} />);
    
    // Each filename appears twice (title and path), use getAllByText
    expect(screen.getAllByText("file with spaces.md")).toHaveLength(2);
    expect(screen.getAllByText("file-with-dashes.md")).toHaveLength(2);
    expect(screen.getAllByText("file_with_underscores.md")).toHaveLength(2);
  });

  it("renders long file paths correctly", () => {
    const longPath = "very/long/nested/path/structure/with/many/levels/file.md";
    render(<CitationList sources={[longPath]} />);
    
    expect(screen.getByText("file.md")).toBeInTheDocument();
    expect(screen.getByText(longPath)).toBeInTheDocument();
  });
});
