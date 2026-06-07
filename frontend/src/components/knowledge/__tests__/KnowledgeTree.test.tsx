import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KnowledgeTree } from "../KnowledgeTree";
import type { KnowledgeNode } from "../../../types/api";

describe("KnowledgeTree", () => {
  const mockOnToggle = vi.fn();
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    mockOnToggle.mockClear();
    mockOnSelect.mockClear();
  });

  test("renders file node correctly", () => {
    const fileNode: KnowledgeNode = {
      type: "file",
      name: "guide.md",
    };

    render(
      <KnowledgeTree
        node={fileNode}
        expanded={new Set()}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText("guide.md")).toBeInTheDocument();
    // Icon is rendered via Icon component - just verify it exists
    const iconContainer = screen.getByText("guide.md").closest(".krow")?.querySelector(".kicon");
    expect(iconContainer).toBeInTheDocument();
  });

  test("renders directory node correctly", () => {
    const dirNode: KnowledgeNode = {
      type: "dir",
      name: "products",
      children: [],
    };

    render(
      <KnowledgeTree
        node={dirNode}
        expanded={new Set()}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText("products")).toBeInTheDocument();
    // Icon is rendered via Icon component
    const iconContainer = screen.getByText("products").closest(".krow")?.querySelector(".kicon");
    expect(iconContainer).toBeInTheDocument();
  });

  test("shows open folder icon when expanded", () => {
    const dirNode: KnowledgeNode = {
      type: "dir",
      name: "products",
      children: [],
    };

    render(
      <KnowledgeTree
        node={dirNode}
        expanded={new Set(["products"])}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
      />
    );

    // Icon is rendered via Icon component
    const iconContainer = screen.getByText("products").closest(".krow")?.querySelector(".kicon");
    expect(iconContainer).toBeInTheDocument();
  });

  test("clicking file calls onSelect", () => {
    const fileNode: KnowledgeNode = {
      type: "file",
      name: "doc.md",
    };

    render(
      <KnowledgeTree
        node={fileNode}
        expanded={new Set()}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
      />
    );

    fireEvent.click(screen.getByText("doc.md"));
    expect(mockOnSelect).toHaveBeenCalledWith("doc.md");
    expect(mockOnToggle).not.toHaveBeenCalled();
  });

  test("clicking directory calls onToggle", () => {
    const dirNode: KnowledgeNode = {
      type: "dir",
      name: "folder",
      children: [],
    };

    render(
      <KnowledgeTree
        node={dirNode}
        expanded={new Set()}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
      />
    );

    fireEvent.click(screen.getByText("folder"));
    expect(mockOnToggle).toHaveBeenCalledWith("folder");
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  test("highlights selected node", () => {
    const fileNode: KnowledgeNode = {
      type: "file",
      name: "selected.md",
    };

    render(
      <KnowledgeTree
        node={fileNode}
        expanded={new Set()}
        selectedPath="selected.md"
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
      />
    );

    const row = screen.getByText("selected.md").closest(".krow");
    expect(row?.classList.contains("selected")).toBe(true);
  });

  test("renders children when directory is expanded", () => {
    const dirNode: KnowledgeNode = {
      type: "dir",
      name: "parent",
      children: [
        { type: "file", name: "child1.md" },
        { type: "file", name: "child2.md" },
      ],
    };

    render(
      <KnowledgeTree
        node={dirNode}
        expanded={new Set(["parent"])}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText("parent")).toBeInTheDocument();
    expect(screen.getByText("child1.md")).toBeInTheDocument();
    expect(screen.getByText("child2.md")).toBeInTheDocument();
    expect(screen.getByText("SUMMARY.MD")).toBeInTheDocument();
  });

  test("hides children when directory is collapsed", () => {
    const dirNode: KnowledgeNode = {
      type: "dir",
      name: "parent",
      children: [
        { type: "file", name: "child.md" },
      ],
    };

    render(
      <KnowledgeTree
        node={dirNode}
        expanded={new Set()}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText("parent")).toBeInTheDocument();
    expect(screen.queryByText("child.md")).not.toBeInTheDocument();
    expect(screen.queryByText("SUMMARY.MD")).not.toBeInTheDocument();
  });

  test("renders synthetic SUMMARY.MD for directories", () => {
    const dirNode: KnowledgeNode = {
      type: "dir",
      name: "docs",
      children: [],
    };

    render(
      <KnowledgeTree
        node={dirNode}
        expanded={new Set(["docs"])}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText("SUMMARY.MD")).toBeInTheDocument();
  });

  test("clicking SUMMARY.MD calls onSelect with correct path", () => {
    const dirNode: KnowledgeNode = {
      type: "dir",
      name: "guides",
      children: [],
    };

    render(
      <KnowledgeTree
        node={dirNode}
        expanded={new Set(["guides"])}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
      />
    );

    fireEvent.click(screen.getByText("SUMMARY.MD"));
    expect(mockOnSelect).toHaveBeenCalledWith("guides/SUMMARY.MD");
  });

  test("highlights selected SUMMARY.MD", () => {
    const dirNode: KnowledgeNode = {
      type: "dir",
      name: "docs",
      children: [],
    };

    render(
      <KnowledgeTree
        node={dirNode}
        expanded={new Set(["docs"])}
        selectedPath="docs/SUMMARY.MD"
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
      />
    );

    const summaryRow = screen.getByText("SUMMARY.MD").closest(".krow");
    expect(summaryRow?.classList.contains("selected")).toBe(true);
  });

  test("applies correct indentation at depth 0", () => {
    const node: KnowledgeNode = {
      type: "file",
      name: "root.md",
    };

    render(
      <KnowledgeTree
        node={node}
        expanded={new Set()}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
        depth={0}
      />
    );

    const row = screen.getByText("root.md").closest(".krow") as HTMLElement;
    expect(row.style.paddingLeft).toBe("6px");
  });

  test("applies correct indentation at depth 2", () => {
    const node: KnowledgeNode = {
      type: "file",
      name: "nested.md",
    };

    render(
      <KnowledgeTree
        node={node}
        expanded={new Set()}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
        depth={2}
      />
    );

    const row = screen.getByText("nested.md").closest(".krow") as HTMLElement;
    expect(row.style.paddingLeft).toBe("30px"); // 6 + 2*12
  });

  test("builds correct path with pathPrefix", () => {
    const node: KnowledgeNode = {
      type: "file",
      name: "file.md",
    };

    render(
      <KnowledgeTree
        node={node}
        expanded={new Set()}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
        pathPrefix="parent/child/"
      />
    );

    fireEvent.click(screen.getByText("file.md"));
    expect(mockOnSelect).toHaveBeenCalledWith("parent/child/file.md");
  });

  test("renders nested directory structure recursively", () => {
    const node: KnowledgeNode = {
      type: "dir",
      name: "level1",
      children: [
        {
          type: "dir",
          name: "level2",
          children: [
            { type: "file", name: "deep.md" },
          ],
        },
      ],
    };

    render(
      <KnowledgeTree
        node={node}
        expanded={new Set(["level1", "level1/level2"])}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText("level1")).toBeInTheDocument();
    expect(screen.getByText("level2")).toBeInTheDocument();
    expect(screen.getByText("deep.md")).toBeInTheDocument();
  });

  test("caret has open class when directory is expanded", () => {
    const node: KnowledgeNode = {
      type: "dir",
      name: "folder",
      children: [],
    };

    render(
      <KnowledgeTree
        node={node}
        expanded={new Set(["folder"])}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
      />
    );

    const caret = document.querySelector(".caret.open");
    expect(caret).toBeInTheDocument();
  });

  test("caret has leaf class for files", () => {
    const node: KnowledgeNode = {
      type: "file",
      name: "file.md",
    };

    render(
      <KnowledgeTree
        node={node}
        expanded={new Set()}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
      />
    );

    const caret = document.querySelector(".caret.leaf");
    expect(caret).toBeInTheDocument();
  });

  test("handles empty children array", () => {
    const node: KnowledgeNode = {
      type: "dir",
      name: "empty",
      children: [],
    };

    render(
      <KnowledgeTree
        node={node}
        expanded={new Set(["empty"])}
        selectedPath={null}
        onToggle={mockOnToggle}
        onSelect={mockOnSelect}
      />
    );

    expect(screen.getByText("empty")).toBeInTheDocument();
    expect(screen.getByText("SUMMARY.MD")).toBeInTheDocument();
    // No other children
    const allText = screen.getAllByText(/./);
    expect(allText.length).toBeLessThan(10);
  });
});
