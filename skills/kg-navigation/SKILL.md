---
name: kg-navigation
description: "Navigate the knowledge base using the knowledge graph. Use when answering questions about Aviva products and services to find the right page faster."
---

# Knowledge Graph Navigation

Use this skill when you need to find information in the Aviva knowledge base. It replaces manual SUMMARY.MD traversal with a single search call.

## When to use

Always use `search_knowledge_graph` before reading any SUMMARY.MD. Only fall back to SUMMARY.MD navigation if `search_knowledge_graph` returns an empty list (`[]`).

## How to search

1. Identify the section from the user's question (see table below).
2. Call `search_knowledge_graph` with the user's question as the query:

```json
{"query": "what does home insurance cover", "section": "insurance"}
```

3. Read the returned titles and summaries. Read every path whose summary looks relevant — do not stop at one if multiple results could contribute to the answer.
4. Call `read_knowledge` on each selected path.

If the domain is unclear across multiple sections, omit `section` to search globally:

```json
{"query": "Aviva pension options for employers"}
```

## Section reference

| Section | Covers |
|---------|--------|
| `business` | Employer products, workplace pensions, group protection, defined benefit |
| `health` | Health insurance, health cash plans, medical cover |
| `health-insurance` | Personal health insurance products |
| `health-providers` | GP services, healthcare provider information |
| `insurance` | Home, car, travel, life insurance |
| `investments` | ISAs, funds, investment bonds |
| `retirement` | Personal pensions, annuities, income drawdown |
| `risksolutions` | Risk and protection products |
| `services` | General Aviva services |
| `help-and-support` | Help articles, FAQs, contact information |

## Interpreting results

Each result has `path`, `title`, and `summary`. Use the summary to judge relevance — read every `index.md` whose summary could contribute to the answer. Only skip a result if its summary is clearly unrelated to the question.

## Fallback

If `search_knowledge_graph` returns `[]`, the graph is not populated. Fall back to:
1. `read_knowledge` with `SUMMARY.MD` to explore sections
2. Navigate down using section-level SUMMARY.MD files
