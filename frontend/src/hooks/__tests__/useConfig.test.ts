import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useConfig } from "../useConfig";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock("../../utils/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("useConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Runtime Config Tests
  describe("runtime config", () => {
    it("fetches runtime config from /api/config", async () => {
      const mockRuntimeConfig = {
        model: "claude-4.5-sonnet",
        provider: "litellm",
        user: "Test User",
        org: "Test Org",
      };

      mockFetch.mockImplementation((url: string) => {
        if (url === "http://localhost:8000/api/config") {
          return Promise.resolve({
            ok: true,
            json: async () => mockRuntimeConfig,
          });
        }
        // Mock skills endpoint to prevent hanging
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => expect(result.current.runtimeConfig).not.toBeNull());

      expect(result.current.runtimeConfig).toEqual(mockRuntimeConfig);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/config",
        undefined
      );
    });

    it("sets runtimeConfig state with user, org, model, provider", async () => {
      const mockRuntimeConfig = {
        model: "gpt-4",
        provider: "openai",
        user: "Jane Doe",
        org: "Acme Corp",
      };

      mockFetch.mockImplementation((url: string) => {
        if (url === "http://localhost:8000/api/config") {
          return Promise.resolve({
            ok: true,
            json: async () => mockRuntimeConfig,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => expect(result.current.runtimeConfig).not.toBeNull());

      expect(result.current.runtimeConfig?.model).toBe("gpt-4");
      expect(result.current.runtimeConfig?.provider).toBe("openai");
      expect(result.current.runtimeConfig?.user).toBe("Jane Doe");
      expect(result.current.runtimeConfig?.org).toBe("Acme Corp");
    });

    it("handles runtime config fetch errors", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === "http://localhost:8000/api/config") {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      });

      const { result } = renderHook(() => useConfig());

      // Wait a bit for the fetch to complete
      await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/config",
        undefined
      ));

      // Runtime config should remain null on error
      expect(result.current.runtimeConfig).toBeNull();
    });
  });

  // Skills Selection Tests
  describe("skills selection", () => {
    it("fetches skills list from /api/skills", async () => {
      const mockSkills = [
        { name: "python-coder", description: "Expert Python programmer" },
        { name: "summariser", description: "Summarizes documents" },
      ];

      mockFetch.mockImplementation((url: string) => {
        if (url === "http://localhost:8000/api/skills") {
          return Promise.resolve({
            ok: true,
            json: async () => mockSkills,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => expect(result.current.config.skills?.length).toBeGreaterThan(0));

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/skills",
        undefined
      );
    });

    it("auto-selects all skills by default", async () => {
      const mockSkills = [
        { name: "skill1", description: "First skill" },
        { name: "skill2", description: "Second skill" },
        { name: "skill3", description: "Third skill" },
      ];

      mockFetch.mockImplementation((url: string) => {
        if (url === "http://localhost:8000/api/skills") {
          return Promise.resolve({
            ok: true,
            json: async () => mockSkills,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => expect(result.current.config.skills?.length).toBe(3));

      expect(result.current.config.skills).toEqual(["skill1", "skill2", "skill3"]);
    });

    it("handles skills fetch errors", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === "http://localhost:8000/api/skills") {
          return Promise.reject(new Error("Skills API error"));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const { result } = renderHook(() => useConfig());

      // Wait for fetch to complete
      await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/skills",
        undefined
      ));

      // Skills should remain empty array on error
      expect(result.current.config.skills).toEqual([]);
    });

    it("toggleSkill adds skill when not present", async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => [],
        })
      );

      const { result } = renderHook(() => useConfig());

      // Wait for initial load
      await waitFor(() => expect(result.current.config.skills).toEqual([]));

      // Add a skill
      act(() => {
        result.current.toggleSkill("new-skill");
      });

      expect(result.current.config.skills).toContain("new-skill");
      expect(result.current.config.skills?.length).toBe(1);
    });

    it("toggleSkill removes skill when present", async () => {
      const mockSkills = [
        { name: "skill1", description: "First" },
        { name: "skill2", description: "Second" },
      ];

      mockFetch.mockImplementation((url: string) => {
        if (url === "http://localhost:8000/api/skills") {
          return Promise.resolve({
            ok: true,
            json: async () => mockSkills,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => expect(result.current.config.skills?.length).toBe(2));

      // Remove skill1
      act(() => {
        result.current.toggleSkill("skill1");
      });

      expect(result.current.config.skills).not.toContain("skill1");
      expect(result.current.config.skills).toContain("skill2");
      expect(result.current.config.skills?.length).toBe(1);
    });

    it("toggleSkill preserves other skills", async () => {
      const mockSkills = [
        { name: "skill1", description: "First" },
        { name: "skill2", description: "Second" },
        { name: "skill3", description: "Third" },
      ];

      mockFetch.mockImplementation((url: string) => {
        if (url === "http://localhost:8000/api/skills") {
          return Promise.resolve({
            ok: true,
            json: async () => mockSkills,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => expect(result.current.config.skills?.length).toBe(3));

      // Toggle skill2 off
      act(() => {
        result.current.toggleSkill("skill2");
      });

      expect(result.current.config.skills).toContain("skill1");
      expect(result.current.config.skills).toContain("skill3");
      expect(result.current.config.skills).not.toContain("skill2");
      expect(result.current.config.skills?.length).toBe(2);

      // Toggle skill2 back on
      act(() => {
        result.current.toggleSkill("skill2");
      });

      expect(result.current.config.skills).toContain("skill1");
      expect(result.current.config.skills).toContain("skill2");
      expect(result.current.config.skills).toContain("skill3");
      expect(result.current.config.skills?.length).toBe(3);
    });
  });

  // Integration Tests
  describe("integration", () => {
    it("both fetches happen in parallel on mount", async () => {
      const mockRuntimeConfig = {
        model: "claude-4.5-sonnet",
        provider: "litellm",
        user: "Test User",
        org: "Test Org",
      };

      const mockSkills = [
        { name: "skill1", description: "First" },
      ];

      mockFetch.mockImplementation((url: string) => {
        if (url === "http://localhost:8000/api/config") {
          return Promise.resolve({
            ok: true,
            json: async () => mockRuntimeConfig,
          });
        }
        if (url === "http://localhost:8000/api/skills") {
          return Promise.resolve({
            ok: true,
            json: async () => mockSkills,
          });
        }
        return Promise.reject(new Error("Unknown endpoint"));
      });

      const { result } = renderHook(() => useConfig());

      // Both should be called
      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/config",
        undefined
      );
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/skills",
        undefined
      );

      // Wait for both to complete
      await waitFor(() => {
        return (
          result.current.runtimeConfig !== null &&
          result.current.config.skills?.length === 1
        );
      });

      expect(result.current.runtimeConfig).toEqual(mockRuntimeConfig);
      expect(result.current.config.skills).toEqual(["skill1"]);
    });

    it("only fetches skills once (skillsLoaded flag)", async () => {
      const mockSkills = [
        { name: "test-skill", description: "Test" },
      ];

      let skillsFetchCount = 0;

      mockFetch.mockImplementation((url: string) => {
        if (url === "http://localhost:8000/api/skills") {
          skillsFetchCount++;
          return Promise.resolve({
            ok: true,
            json: async () => mockSkills,
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const { result, rerender } = renderHook(() => useConfig());

      await waitFor(() => expect(result.current.config.skills?.length).toBe(1));

      const initialSkillsFetchCount = skillsFetchCount;

      // Re-render multiple times
      rerender();
      rerender();
      rerender();

      // Wait a bit to ensure no additional fetches
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Skills should only be fetched once
      expect(skillsFetchCount).toBe(initialSkillsFetchCount);
      expect(skillsFetchCount).toBe(1);
    });

    it("handles empty skills array without crashing", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === "http://localhost:8000/api/skills") {
          return Promise.resolve({
            ok: true,
            json: async () => [],
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      });

      const { result } = renderHook(() => useConfig());

      await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8000/api/skills",
        undefined
      ));

      expect(result.current.config.skills).toEqual([]);

      // Should be able to add skills even when starting empty
      act(() => {
        result.current.toggleSkill("manual-skill");
      });

      expect(result.current.config.skills).toEqual(["manual-skill"]);
    });

    it("initializes with correct default state", () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useConfig());

      expect(result.current.config).toEqual({ skills: [] });
      expect(result.current.runtimeConfig).toBeNull();
      expect(typeof result.current.toggleSkill).toBe("function");
    });
  });
});
