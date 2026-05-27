import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Icon } from "../shared/Icon";

describe("Icon", () => {
  it("renders chevron icon", () => {
    const { container } = render(<Icon name="chevron" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.querySelector("polyline")).toBeInTheDocument();
  });

  it("renders folder icon", () => {
    const { container } = render(<Icon name="folder" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("applies default size", () => {
    const { container } = render(<Icon name="folder" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "14");
    expect(svg).toHaveAttribute("height", "14");
  });

  it("applies custom size prop", () => {
    const { container } = render(<Icon name="folder" size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
  });

  it("renders all icon types", () => {
    const iconNames = [
      "chevron",
      "folder",
      "folder-open",
      "file",
      "file-summary",
      "search",
      "send",
      "plus",
      "sun",
      "moon",
      "settings",
      "gear",
      "message",
      "back",
      "zap",
    ] as const;

    iconNames.forEach((name) => {
      const { container } = render(<Icon name={name} />);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  it("has correct stroke properties", () => {
    const { container } = render(<Icon name="folder" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("fill", "none");
  });
});
