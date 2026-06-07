import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReasoningTrace } from "../ReasoningTrace";
import type { TraceStep } from "../../../types/api";

describe("ReasoningTrace", () => {
  test("renders thinking state when running", () => {
    const steps: TraceStep[] = [
      { kind: "think", text: "Analyzing the question..." },
    ];

    render(<ReasoningTrace steps={steps} running={true} elapsed={2} />);

    expect(screen.getByText("Thinking…")).toBeInTheDocument();
    const activeDot = document.querySelector(".dot.active");
    expect(activeDot).toBeInTheDocument();
  });

  test("renders thought process when complete", () => {
    const steps: TraceStep[] = [
      { kind: "think", text: "Done thinking" },
    ];

    render(<ReasoningTrace steps={steps} running={false} elapsed={5} />);

    expect(screen.getByText("Thought process")).toBeInTheDocument();
    const activeDot = document.querySelector(".dot.active");
    expect(activeDot).not.toBeInTheDocument();
  });

  test("displays statistics correctly", () => {
    const steps: TraceStep[] = [
      { kind: "search", query: "life insurance" },
      { kind: "search", query: "claims process" },
      { kind: "read", path: "/guide/claims.md" },
      { kind: "read", path: "/guide/benefits.md" },
      { kind: "read", path: "/guide/process.md" },
      { kind: "skill", name: "summarizer", desc: "Summarize content" },
    ];

    render(<ReasoningTrace steps={steps} running={false} elapsed={12} />);

    expect(screen.getByText(/2 searches/)).toBeInTheDocument();
    expect(screen.getByText(/3 read/)).toBeInTheDocument();
    expect(screen.getByText(/1 skill/)).toBeInTheDocument();
    expect(screen.getByText(/12s/)).toBeInTheDocument();
  });

  test("uses singular form for single items", () => {
    const steps: TraceStep[] = [
      { kind: "search", query: "test" },
      { kind: "read", path: "/test.md" },
      { kind: "skill", name: "test", desc: "test skill" },
    ];

    render(<ReasoningTrace steps={steps} running={false} elapsed={1} />);

    expect(screen.getByText(/1 search ·/)).toBeInTheDocument();
    expect(screen.getByText(/1 skill/)).toBeInTheDocument();
  });

  test("toggles open/closed on header click", () => {
    const steps: TraceStep[] = [
      { kind: "think", text: "Test" },
    ];

    render(<ReasoningTrace steps={steps} running={false} elapsed={1} />);

    const trace = document.querySelector(".trace");
    expect(trace?.classList.contains("open")).toBe(true);

    const header = screen.getByText("Thought process").closest(".trace-head");
    fireEvent.click(header!);

    expect(trace?.classList.contains("open")).toBe(false);

    fireEvent.click(header!);
    expect(trace?.classList.contains("open")).toBe(true);
  });

  test("renders think step correctly", () => {
    const steps: TraceStep[] = [
      { kind: "think", text: "I need to search for information" },
    ];

    render(<ReasoningTrace steps={steps} running={false} elapsed={1} />);

    expect(screen.getByText("I need to search for information")).toBeInTheDocument();
    const thinkStep = document.querySelector(".step.think");
    expect(thinkStep).toBeInTheDocument();
  });

  test("renders read step with breadcrumb", () => {
    const steps: TraceStep[] = [
      { kind: "read", path: "products/life/term-life.md" },
    ];

    render(<ReasoningTrace steps={steps} running={false} elapsed={1} />);

    expect(screen.getByText("read_knowledge")).toBeInTheDocument();
    expect(screen.getByText("products/life/term-life.md")).toBeInTheDocument();
    
    // Check breadcrumb parts
    expect(screen.getByText("products")).toBeInTheDocument();
    expect(screen.getByText("life")).toBeInTheDocument();
    expect(screen.getByText("term-life.md")).toBeInTheDocument();
  });

  test("renders search step with query", () => {
    const steps: TraceStep[] = [
      { kind: "search", query: "life insurance benefits" },
    ];

    render(<ReasoningTrace steps={steps} running={false} elapsed={1} />);

    expect(screen.getByText("search_knowledge_graph")).toBeInTheDocument();
    expect(screen.getByText("life insurance benefits")).toBeInTheDocument();
  });

  test("renders search step with section", () => {
    const steps: TraceStep[] = [
      { kind: "search", query: "benefits", section: "Employee Protection" },
    ];

    render(<ReasoningTrace steps={steps} running={false} elapsed={1} />);

    // Text may be split across elements - check parent contains both
    const stepBody = document.querySelector('.step.search .step-body');
    expect(stepBody?.textContent).toContain('benefits');
    expect(stepBody?.textContent).toContain('Employee Protection');
  });

  test("renders skill step", () => {
    const steps: TraceStep[] = [
      { kind: "skill", name: "python-coder", desc: "Execute Python code" },
    ];

    render(<ReasoningTrace steps={steps} running={false} elapsed={1} />);

    expect(screen.getByText("SKILL")).toBeInTheDocument();
    expect(screen.getByText("python-coder")).toBeInTheDocument();
    expect(screen.getByText("· Execute Python code")).toBeInTheDocument();
  });

  test("marks last step as active when running", () => {
    const steps: TraceStep[] = [
      { kind: "think", text: "First" },
      { kind: "read", path: "/test.md" },
      { kind: "search", query: "current query" },
    ];

    render(<ReasoningTrace steps={steps} running={true} elapsed={3} />);

    const searchStep = screen.getByText("current query").closest(".step");
    expect(searchStep?.classList.contains("active")).toBe(true);

    const readStep = screen.getByText("/test.md").closest(".step");
    expect(readStep?.classList.contains("active")).toBe(false);
  });

  test("handles empty steps array", () => {
    render(<ReasoningTrace steps={[]} running={false} elapsed={0} />);

    expect(screen.getByText(/0 read · 0 skills · 0s/)).toBeInTheDocument();
  });

  test("handles mixed step types", () => {
    const steps: TraceStep[] = [
      { kind: "think", text: "Starting analysis" },
      { kind: "search", query: "topic A" },
      { kind: "read", path: "/doc1.md" },
      { kind: "skill", name: "analyzer", desc: "Analyze data" },
      { kind: "think", text: "Continuing..." },
      { kind: "search", query: "topic B", section: "Details" },
      { kind: "read", path: "/doc2.md" },
    ];

    render(<ReasoningTrace steps={steps} running={false} elapsed={10} />);

    expect(screen.getByText(/2 searches/)).toBeInTheDocument();
    expect(screen.getByText(/2 read/)).toBeInTheDocument();
    expect(screen.getByText(/1 skill/)).toBeInTheDocument();

    // Verify key steps are rendered (text may be split across elements)
    expect(screen.getByText("Starting analysis")).toBeInTheDocument();
    expect(screen.getByText("analyzer")).toBeInTheDocument();
    expect(screen.getByText("Continuing...")).toBeInTheDocument();
    
    // Check trace body contains all content
    const traceBody = document.querySelector('.trace-body');
    const bodyText = traceBody?.textContent || '';
    expect(bodyText).toContain('topic A');
    expect(bodyText).toContain('/doc1.md');
    expect(bodyText).toContain('topic B');
    expect(bodyText).toContain('/doc2.md');
  });

  test("breadcrumb handles root path", () => {
    const steps: TraceStep[] = [
      { kind: "read", path: "single.md" },
    ];

    render(<ReasoningTrace steps={steps} running={false} elapsed={1} />);

    // Check that path is in the trace body (may be split by tags)
    const traceBody = document.querySelector('.trace-body');
    expect(traceBody?.textContent).toContain('single.md');
    
    const separators = document.querySelectorAll(".breadcrumb-sep");
    expect(separators.length).toBe(0);
  });

  test("breadcrumb handles deep paths", () => {
    const steps: TraceStep[] = [
      { kind: "read", path: "a/b/c/d/e/file.md" },
    ];

    render(<ReasoningTrace steps={steps} running={false} elapsed={1} />);

    const separators = document.querySelectorAll(".breadcrumb-sep");
    expect(separators.length).toBe(5); // One less than parts count
  });

  test("active breadcrumb styling when running", () => {
    const steps: TraceStep[] = [
      { kind: "read", path: "test/path.md" },
    ];

    render(<ReasoningTrace steps={steps} running={true} elapsed={1} />);

    const breadcrumb = document.querySelector(".breadcrumb.active");
    expect(breadcrumb).toBeInTheDocument();
  });
});
