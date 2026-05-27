import type { KnowledgeNode, KnowledgeTree } from "../types/api";

export interface FlatNode extends KnowledgeNode {
  path: string;
  depth: number;
}

export function flatten(root: KnowledgeTree["root"]): FlatNode[] {
  const out: FlatNode[] = [];

  function walk(children: KnowledgeNode[], prefix: string, depth: number) {
    for (const c of children) {
      const path = prefix + c.name;
      out.push({ ...c, path, depth });
      if (c.type === "dir" && c.children) {
        walk(c.children, path + "/", depth + 1);
      }
    }
  }

  walk(root.children, "", 0);
  return out;
}

export function resolvePath(
  path: string,
  knowledgeTree: KnowledgeTree
): KnowledgeNode | null {
  const flat = flatten(knowledgeTree.root);

  if (path.endsWith("SUMMARY.MD")) {
    const dirPath = path.replace(/\/?SUMMARY\.MD$/, "");
    if (dirPath === "") {
      return {
        type: "dir",
        synthetic: "summary",
        dirPath: "",
        name: "knowledge",
        summary: knowledgeTree.root.summary,
        children: knowledgeTree.root.children,
      };
    }
    const dir = flat.find((n) => n.type === "dir" && n.path === dirPath);
    if (dir) {
      return {
        type: "dir",
        synthetic: "summary",
        dirPath,
        name: dir.name,
        summary: dir.summary,
        children: dir.children,
      };
    }
    return null;
  }

  return flat.find((n) => n.path === path) || null;
}
