import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MarkdownRenderer } from "../shared/MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders plain text", () => {
    const { container } = render(<MarkdownRenderer source="Hello world" />);
    expect(container.textContent).toBe("Hello world");
  });

  it("renders bold text", () => {
    render(<MarkdownRenderer source="**bold**" />);
    const bold = screen.getByText("bold");
    expect(bold.tagName).toBe("STRONG");
  });

  it("renders italic text", () => {
    const { container } = render(<MarkdownRenderer source="*italic*" />);
    const italic = container.querySelector("em");
    expect(italic).toBeInTheDocument();
    expect(italic?.textContent).toBe("italic");
  });

  it("renders inline code", () => {
    const { container } = render(<MarkdownRenderer source="`code`" />);
    const code = container.querySelector("code");
    expect(code).toBeInTheDocument();
    expect(code?.textContent).toBe("code");
  });

  it("renders links", () => {
    render(<MarkdownRenderer source="[link](https://example.com)" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveTextContent("link");
  });

  it("renders headings", () => {
    const { container } = render(<MarkdownRenderer source="# Heading 1" />);
    const heading = container.querySelector("h2");
    expect(heading).toBeInTheDocument();
    expect(heading?.textContent).toBe("Heading 1");
  });

  it("renders heading", () => {
    const { container } = render(<MarkdownRenderer source="# Heading 1" />);
    const heading = container.querySelector("h2");
    expect(heading).toBeInTheDocument();
    expect(heading?.textContent).toBe("Heading 1");
  });

  it("renders second-level heading", () => {
    const { container } = render(<MarkdownRenderer source="## Heading 2" />);
    const heading = container.querySelector("h3");
    expect(heading).toBeInTheDocument();
    expect(heading?.textContent).toBe("Heading 2");
  });

  it("renders single paragraph", () => {
    const { container } = render(<MarkdownRenderer source="Single paragraph" />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBe(1);
    expect(paragraphs[0].textContent).toBe("Single paragraph");
  });

  it("renders list item", () => {
    const { container } = render(<MarkdownRenderer source="- Item 1" />);
    const list = container.querySelector("ul");
    const items = container.querySelectorAll("li");
    expect(list).toBeInTheDocument();
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].textContent).toBe("Item 1");
  });

  it("renders tables", () => {
    const source = `| Col1 | Col2 |
| ---- | ---- |
| A    | B    |
| C    | D    |`;
    const { container } = render(<MarkdownRenderer source={source} />);
    const table = container.querySelector("table");
    const headers = container.querySelectorAll("th");
    const rows = container.querySelectorAll("tbody tr");
    expect(table).toBeInTheDocument();
    expect(headers.length).toBe(2);
    expect(headers[0].textContent).toBe("Col1");
    expect(headers[1].textContent).toBe("Col2");
    expect(rows.length).toBe(2);
  });

  it("renders citations with citeMap", () => {
    const citeMap = { "[1]": "/path/to/file.md" };
    const { container } = render(
      <MarkdownRenderer source="Reference [1]" citeMap={citeMap} />
    );
    const cite = container.querySelector(".cite");
    expect(cite).toBeInTheDocument();
    expect(cite?.textContent).toBe("1");
    expect(cite?.getAttribute("title")).toBe("/path/to/file.md");
  });

  it("renders complex markdown with mixed formatting", () => {
    const source = "This is **bold** and *italic* with `code` and [link](https://example.com)";
    const { container } = render(<MarkdownRenderer source={source} />);
    expect(container.querySelector("strong")).toBeInTheDocument();
    expect(container.querySelector("em")).toBeInTheDocument();
    expect(container.querySelector("code")).toBeInTheDocument();
    expect(container.querySelector("a")).toBeInTheDocument();
  });

  it("returns null for empty source", () => {
    const { container } = render(<MarkdownRenderer source="" />);
    expect(container.textContent).toBe("");
  });

  it("renders text in paragraphs", () => {
    const { container } = render(<MarkdownRenderer source="Simple text" />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs.length).toBeGreaterThanOrEqual(1);
    expect(container.textContent).toContain("Simple text");
  });
});
