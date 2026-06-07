import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FilePreview } from "../FilePreview";
import type { KnowledgeTree, Frontmatter } from "../../../types/api";

// Mock dependencies
vi.mock("../../shared/MarkdownRenderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  ),
}));

vi.mock("../../../utils/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("../../../hooks/useApiState", () => ({
  useApiState: () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return {
      loading,
      error,
      setLoading,
      setError,
      resetError: () => setError(null),
    };
  },
}));

import { useState } from "react";

const mockTree: KnowledgeTree = {
  brand: "Test Brand",
  root: {
    path: "/",
    name: "root",
    summary: "Root summary",
    children: [
      {
        type: "dir",
        name: "products",
        summary: "Products overview",
        children: [
          {
            type: "file",
            name: "life.md",
          },
        ],
      },
    ],
  },
};

const mockFrontmatter: Frontmatter = {
  url: "https://example.com/doc",
  title: "Test Document",
  summary: "Test summary",
  topics: ["topic1", "topic2"],
  keywords: ["key1", "key2"],
};

describe("FilePreview", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  test("renders nothing when path is null", () => {
    const { container } = render(
      <FilePreview path={null} tree={mockTree} onBack={() => {}} />
    );

    expect(container.firstChild).toBeNull();
  });

  test("shows loading state while fetching", async () => {
    (global.fetch as any).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<FilePreview path="test.md" tree={mockTree} onBack={() => {}} />);

    // FilePreview shows "Loading..." text
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  test("displays error state on fetch failure", async () => {
    (global.fetch as any).mockRejectedValue(new Error("Network error"));

    render(<FilePreview path="test.md" tree={mockTree} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Error: Network error/)).toBeInTheDocument();
    });
  });

  test("fetches and displays file content", async () => {
    const mockFileData = {
      path: "test.md",
      frontmatter: mockFrontmatter,
      body: "# Test Content\n\nThis is test content.",
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockFileData,
    });

    render(<FilePreview path="test.md" tree={mockTree} onBack={() => {}} />);

    await waitFor(() => {
      // Text is rendered but may be split across elements - check title exists
      const title = document.querySelector('.ktitle');
      expect(title?.textContent).toBe('Test Document');
    });

    // Check frontmatter values are present
    const preview = document.querySelector('.kpreview-body');
    expect(preview?.textContent).toContain('Test summary');
    expect(preview?.textContent).toContain('topic1');
    expect(preview?.textContent).toContain('topic2');
    expect(preview?.textContent).toContain('key1');
    expect(preview?.textContent).toContain('key2');

    // Markdown renderer is mocked and should show the body
    const markdown = screen.getByTestId("markdown-renderer");
    expect(markdown).toBeInTheDocument();
  });

  test("displays root SUMMARY.MD", () => {
    render(
      <FilePreview path="SUMMARY.MD" tree={mockTree} onBack={() => {}} />
    );

    // resolveSummaryNode returns "Knowledge" as name for root
    expect(screen.getByText("Knowledge")).toBeInTheDocument();
    expect(screen.getByText("Root summary")).toBeInTheDocument();
    // Directory shown with / suffix
    expect(screen.getByText("products/")).toBeInTheDocument();
  });

  test("displays directory SUMMARY.MD", () => {
    render(
      <FilePreview path="products/SUMMARY.MD" tree={mockTree} onBack={() => {}} />
    );

    expect(screen.getByText("products")).toBeInTheDocument();
    expect(screen.getByText("Products overview")).toBeInTheDocument();
    // File shown without / suffix
    expect(screen.getByText("life.md")).toBeInTheDocument();
  });

  test("calls onBack when back button clicked", async () => {
    const mockOnBack = vi.fn();
    const mockFileData = {
      path: "test.md",
      frontmatter: mockFrontmatter,
      body: "Content",
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockFileData,
    });

    render(<FilePreview path="test.md" tree={mockTree} onBack={mockOnBack} />);

    await waitFor(() => {
      expect(screen.getByText("Test Document")).toBeInTheDocument();
    });

    const backButton = screen.getByRole("button", { name: /back/i });
    backButton.click();

    expect(mockOnBack).toHaveBeenCalled();
  });

  test("fetches from correct API endpoint", async () => {
    const mockFileData = {
      path: "docs/guide.md",
      frontmatter: mockFrontmatter,
      body: "Guide content",
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockFileData,
    });

    render(<FilePreview path="docs/guide.md" tree={mockTree} onBack={() => {}} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/knowledge/file?path=docs%2Fguide.md")
      );
    });
  });

  test("handles fetch error with non-ok response", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      statusText: "Not Found",
    });

    render(<FilePreview path="missing.md" tree={mockTree} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load file/)).toBeInTheDocument();
    });
  });

  test("refetches when path changes", async () => {
    const mockFileData1 = {
      path: "file1.md",
      frontmatter: { ...mockFrontmatter, title: "File 1" },
      body: "Content 1",
    };

    const mockFileData2 = {
      path: "file2.md",
      frontmatter: { ...mockFrontmatter, title: "File 2" },
      body: "Content 2",
    };

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockFileData1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockFileData2,
      });

    const { rerender } = render(
      <FilePreview path="file1.md" tree={mockTree} onBack={() => {}} />
    );

    await waitFor(() => {
      expect(screen.getByText("File 1")).toBeInTheDocument();
    });

    rerender(<FilePreview path="file2.md" tree={mockTree} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("File 2")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("handles SUMMARY.MD for non-existent directory", () => {
    // Mock fetch to return file not found
    (global.fetch as any).mockResolvedValue({
      ok: false,
      statusText: "Not Found",
    });

    render(
      <FilePreview path="nonexistent/SUMMARY.MD" tree={mockTree} onBack={() => {}} />
    );

    // Since summaryNode returns null, it tries to fetch and will show error
    // Wait for the error state to appear
    waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });

  test("renders children in SUMMARY.MD view", () => {
    const treeWithMultipleChildren: KnowledgeTree = {
      brand: "Test",
      root: {
        path: "/",
        name: "root",
        summary: "Root",
        children: [
          { type: "file", name: "readme.md" },
          { type: "dir", name: "guides", children: [] },
          { type: "file", name: "faq.md" },
        ],
      },
    };

    render(
      <FilePreview
        path="SUMMARY.MD"
        tree={treeWithMultipleChildren}
        onBack={() => {}}
      />
    );

    expect(screen.getByText("readme.md")).toBeInTheDocument();
    // Directories shown with / suffix in SUMMARY view
    expect(screen.getByText("guides/")).toBeInTheDocument();
    expect(screen.getByText("faq.md")).toBeInTheDocument();
  });

  test("displays URL in frontmatter", async () => {
    const mockFileData = {
      path: "test.md",
      frontmatter: mockFrontmatter,
      body: "Content",
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockFileData,
    });

    render(<FilePreview path="test.md" tree={mockTree} onBack={() => {}} />);

    await waitFor(() => {
      const urlLink = screen.getByRole("link", { name: mockFrontmatter.url });
      expect(urlLink).toBeInTheDocument();
      expect(urlLink).toHaveAttribute("href", mockFrontmatter.url);
    });
  });

  test("handles empty topics array", async () => {
    const mockFileData = {
      path: "test.md",
      frontmatter: { ...mockFrontmatter, topics: [] },
      body: "Content",
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockFileData,
    });

    render(<FilePreview path="test.md" tree={mockTree} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Test Document")).toBeInTheDocument();
    });

    // Topics section should still be present but empty
    expect(screen.queryByText("topic1")).not.toBeInTheDocument();
  });

  test("handles empty keywords array", async () => {
    const mockFileData = {
      path: "test.md",
      frontmatter: { ...mockFrontmatter, keywords: [] },
      body: "Content",
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockFileData,
    });

    render(<FilePreview path="test.md" tree={mockTree} onBack={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Test Document")).toBeInTheDocument();
    });

    expect(screen.queryByText("key1")).not.toBeInTheDocument();
  });
});
