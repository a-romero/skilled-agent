import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KnowledgePane } from "../KnowledgePane";

// Mock child components
vi.mock("../../../hooks/useKnowledge", () => ({
  useKnowledge: vi.fn(),
}));

vi.mock("../KnowledgeTree", () => ({
  KnowledgeTree: ({ node, onToggle, onSelect }: any) => (
    <div data-testid="knowledge-tree">
      Tree for: {node.name}
      <button onClick={() => onToggle(node.name)}>Toggle {node.name}</button>
      <button onClick={() => onSelect(`${node.name}/file.md`)}>
        Select {node.name}
      </button>
    </div>
  ),
}));

vi.mock("../FilePreview", () => ({
  FilePreview: ({ path, onBack }: any) => (
    <div data-testid="file-preview">
      Previewing: {path}
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));

import { useKnowledge } from "../../../hooks/useKnowledge";

const mockTree = {
  brand: "Test KB",
  root: {
    path: "/",
    name: "root",
    summary: "Root summary",
    children: [
      { type: "dir", name: "products", children: [] },
      { type: "file", name: "readme.md" },
    ],
  },
};

describe("KnowledgePane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("displays loading state", () => {
    (useKnowledge as any).mockReturnValue({
      tree: null,
      expanded: new Set(),
      selectedPath: null,
      loading: true,
      error: null,
      toggleFolder: vi.fn(),
      selectFile: vi.fn(),
    });

    render(<KnowledgePane />);

    expect(screen.getByText("Loading knowledge...")).toBeInTheDocument();
  });

  test("displays error state", () => {
    (useKnowledge as any).mockReturnValue({
      tree: null,
      expanded: new Set(),
      selectedPath: null,
      loading: false,
      error: "Failed to fetch",
      toggleFolder: vi.fn(),
      selectFile: vi.fn(),
    });

    render(<KnowledgePane />);

    expect(screen.getByText(/Error loading knowledge: Failed to fetch/)).toBeInTheDocument();
  });

  test("displays no data message when tree is null", () => {
    (useKnowledge as any).mockReturnValue({
      tree: null,
      expanded: new Set(),
      selectedPath: null,
      loading: false,
      error: null,
      toggleFolder: vi.fn(),
      selectFile: vi.fn(),
    });

    render(<KnowledgePane />);

    expect(screen.getByText("No knowledge data available")).toBeInTheDocument();
  });

  test("renders header with title and badge", () => {
    (useKnowledge as any).mockReturnValue({
      tree: mockTree,
      expanded: new Set(),
      selectedPath: null,
      loading: false,
      error: null,
      toggleFolder: vi.fn(),
      selectFile: vi.fn(),
    });

    render(<KnowledgePane />);

    expect(screen.getByText("Knowledge")).toBeInTheDocument();
    expect(screen.getByText("Aviva KB")).toBeInTheDocument();
  });

  test("renders search input", () => {
    (useKnowledge as any).mockReturnValue({
      tree: mockTree,
      expanded: new Set(),
      selectedPath: null,
      loading: false,
      error: null,
      toggleFolder: vi.fn(),
      selectFile: vi.fn(),
    });

    render(<KnowledgePane />);

    const searchInput = screen.getByPlaceholderText("Search knowledge…");
    expect(searchInput).toBeInTheDocument();
  });

  test("updates search input on change", () => {
    (useKnowledge as any).mockReturnValue({
      tree: mockTree,
      expanded: new Set(),
      selectedPath: null,
      loading: false,
      error: null,
      toggleFolder: vi.fn(),
      selectFile: vi.fn(),
    });

    render(<KnowledgePane />);

    const searchInput = screen.getByPlaceholderText(
      "Search knowledge…"
    ) as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "test query" } });

    expect(searchInput.value).toBe("test query");
  });

  test("renders root SUMMARY.MD button", () => {
    (useKnowledge as any).mockReturnValue({
      tree: mockTree,
      expanded: new Set(),
      selectedPath: null,
      loading: false,
      error: null,
      toggleFolder: vi.fn(),
      selectFile: vi.fn(),
    });

    render(<KnowledgePane />);

    expect(screen.getByText("SUMMARY.MD")).toBeInTheDocument();
  });

  test("clicking root SUMMARY.MD calls selectFile", () => {
    const mockSelectFile = vi.fn();
    (useKnowledge as any).mockReturnValue({
      tree: mockTree,
      expanded: new Set(),
      selectedPath: null,
      loading: false,
      error: null,
      toggleFolder: vi.fn(),
      selectFile: mockSelectFile,
    });

    render(<KnowledgePane />);

    const summaryButton = screen.getByText("SUMMARY.MD");
    fireEvent.click(summaryButton);

    expect(mockSelectFile).toHaveBeenCalledWith("SUMMARY.MD");
  });

  test("highlights selected root SUMMARY.MD", () => {
    (useKnowledge as any).mockReturnValue({
      tree: mockTree,
      expanded: new Set(),
      selectedPath: "SUMMARY.MD",
      loading: false,
      error: null,
      toggleFolder: vi.fn(),
      selectFile: vi.fn(),
    });

    render(<KnowledgePane />);

    const summaryRow = screen.getByText("SUMMARY.MD").closest(".krow");
    expect(summaryRow?.classList.contains("selected")).toBe(true);
  });

  test("renders KnowledgeTree for each root child", () => {
    (useKnowledge as any).mockReturnValue({
      tree: mockTree,
      expanded: new Set(),
      selectedPath: null,
      loading: false,
      error: null,
      toggleFolder: vi.fn(),
      selectFile: vi.fn(),
    });

    render(<KnowledgePane />);

    expect(screen.getByText("Tree for: products")).toBeInTheDocument();
    expect(screen.getByText("Tree for: readme.md")).toBeInTheDocument();
  });

  test("passes correct props to KnowledgeTree", () => {
    const mockToggleFolder = vi.fn();
    const mockSelectFile = vi.fn();
    const expanded = new Set(["products"]);

    (useKnowledge as any).mockReturnValue({
      tree: mockTree,
      expanded,
      selectedPath: "products/file.md",
      loading: false,
      error: null,
      toggleFolder: mockToggleFolder,
      selectFile: mockSelectFile,
    });

    render(<KnowledgePane />);

    const toggleButton = screen.getByText("Toggle products");
    fireEvent.click(toggleButton);
    expect(mockToggleFolder).toHaveBeenCalledWith("products");

    const selectButton = screen.getByText("Select products");
    fireEvent.click(selectButton);
    expect(mockSelectFile).toHaveBeenCalledWith("products/file.md");
  });

  test("renders FilePreview when path is selected", () => {
    (useKnowledge as any).mockReturnValue({
      tree: mockTree,
      expanded: new Set(),
      selectedPath: "readme.md",
      loading: false,
      error: null,
      toggleFolder: vi.fn(),
      selectFile: vi.fn(),
    });

    render(<KnowledgePane />);

    expect(screen.getByTestId("file-preview")).toBeInTheDocument();
    expect(screen.getByText("Previewing: readme.md")).toBeInTheDocument();
  });

  test("does not render FilePreview when no path selected", () => {
    (useKnowledge as any).mockReturnValue({
      tree: mockTree,
      expanded: new Set(),
      selectedPath: null,
      loading: false,
      error: null,
      toggleFolder: vi.fn(),
      selectFile: vi.fn(),
    });

    render(<KnowledgePane />);

    expect(screen.queryByTestId("file-preview")).not.toBeInTheDocument();
  });

  test("FilePreview back button calls selectFile with null", () => {
    const mockSelectFile = vi.fn();
    (useKnowledge as any).mockReturnValue({
      tree: mockTree,
      expanded: new Set(),
      selectedPath: "readme.md",
      loading: false,
      error: null,
      toggleFolder: vi.fn(),
      selectFile: mockSelectFile,
    });

    render(<KnowledgePane />);

    const backButton = screen.getByText("Back");
    fireEvent.click(backButton);

    expect(mockSelectFile).toHaveBeenCalledWith(null);
  });

  test("handles tree with no children", () => {
    const emptyTree = {
      brand: "Empty",
      root: {
        path: "/",
        name: "root",
        summary: "Empty tree",
        children: [],
      },
    };

    (useKnowledge as any).mockReturnValue({
      tree: emptyTree,
      expanded: new Set(),
      selectedPath: null,
      loading: false,
      error: null,
      toggleFolder: vi.fn(),
      selectFile: vi.fn(),
    });

    render(<KnowledgePane />);

    expect(screen.getByText("Knowledge")).toBeInTheDocument();
    expect(screen.getByText("SUMMARY.MD")).toBeInTheDocument();
    expect(screen.queryByTestId("knowledge-tree")).not.toBeInTheDocument();
  });

  test("maintains search state independently", () => {
    (useKnowledge as any).mockReturnValue({
      tree: mockTree,
      expanded: new Set(),
      selectedPath: null,
      loading: false,
      error: null,
      toggleFolder: vi.fn(),
      selectFile: vi.fn(),
    });

    render(<KnowledgePane />);

    const searchInput = screen.getByPlaceholderText(
      "Search knowledge…"
    ) as HTMLInputElement;

    fireEvent.change(searchInput, { target: { value: "first search" } });
    expect(searchInput.value).toBe("first search");

    fireEvent.change(searchInput, { target: { value: "second search" } });
    expect(searchInput.value).toBe("second search");

    fireEvent.change(searchInput, { target: { value: "" } });
    expect(searchInput.value).toBe("");
  });
});
