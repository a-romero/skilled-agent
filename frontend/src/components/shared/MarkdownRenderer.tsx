import React from "react";

export interface CiteMap {
  [key: string]: string;
}

interface MarkdownRendererProps {
  source: string;
  citeMap?: CiteMap;
}

function renderInline(str: string, citeMap?: CiteMap): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < str.length) {
    const mCite = str.slice(i).match(/^\[(\d+)\]/);
    if (mCite && citeMap && citeMap["[" + mCite[1] + "]"]) {
      const num = mCite[1];
      const path = citeMap["[" + num + "]"];
      out.push(
        <span
          key={key++}
          className="cite"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent("open-knowledge-file", { detail: { path } })
            )
          }
          title={path}
        >
          {num}
        </span>
      );
      i += mCite[0].length;
      continue;
    }

    if (str.slice(i, i + 2) === "**") {
      const end = str.indexOf("**", i + 2);
      if (end > -1) {
        out.push(
          <strong key={key++}>{renderInline(str.slice(i + 2, end), citeMap)}</strong>
        );
        i = end + 2;
        continue;
      }
    }

    if (str[i] === "*" && str[i + 1] !== "*") {
      const end = str.indexOf("*", i + 1);
      if (end > -1) {
        out.push(<em key={key++}>{str.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }

    if (str[i] === "`") {
      const end = str.indexOf("`", i + 1);
      if (end > -1) {
        out.push(<code key={key++}>{str.slice(i + 1, end)}</code>);
        i = end + 1;
        continue;
      }
    }

    const mLink = str.slice(i).match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (mLink) {
      out.push(
        <a
          key={key++}
          href={mLink[2]}
          target="_blank"
          rel="noreferrer"
          style={{ color: "var(--accent)" }}
        >
          {mLink[1]}
        </a>
      );
      i += mLink[0].length;
      continue;
    }

    const nextSpecial = str.slice(i).search(/\*|`|\[/);
    if (nextSpecial === -1) {
      out.push(str.slice(i));
      break;
    } else if (nextSpecial === 0) {
      out.push(str[i]);
      i++;
    } else {
      out.push(str.slice(i, i + nextSpecial));
      i += nextSpecial;
    }
  }

  return out;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  source,
  citeMap,
}) => {
  if (!source) return null;

  const blocks = source.split(/\n{2,}/);
  const nodes: React.ReactNode[] = [];

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    const trimmed = block.trim();
    const lines = trimmed.split("\n");

    // Check for table
    if (
      lines.length >= 2 &&
      lines.every((l) => l.includes("|")) &&
      /^\|?\s*:?-+:?/.test(lines[1])
    ) {
      const rows = lines.map((l) =>
        l
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim())
      );
      const header = rows[0];
      const body = rows.slice(2);

      nodes.push(
        <table key={bi}>
          <thead>
            <tr>
              {header.map((h, i) => (
                <th key={i}>{renderInline(h, citeMap)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (
                  <td key={ci}>{renderInline(c, citeMap)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    }

    // Check for unordered list
    if (lines.every((l) => /^\s*-\s+/.test(l))) {
      nodes.push(
        <ul key={bi}>
          {lines.map((l, i) => (
            <li key={i}>{renderInline(l.replace(/^\s*-\s+/, ""), citeMap)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Check for heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+([^\n]+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingStyles = [
        { margin: "12px 0 8px", fontSize: 18, fontWeight: 700 },
        { margin: "10px 0 6px", fontSize: 16, fontWeight: 600 },
        { margin: "10px 0 6px", fontSize: 14, fontWeight: 600 },
        { margin: "8px 0 4px", fontSize: 13, fontWeight: 600 },
        { margin: "8px 0 4px", fontSize: 12, fontWeight: 600 },
        { margin: "8px 0 4px", fontSize: 12, fontWeight: 500 },
      ];
      const Tag = `h${Math.min(level + 1, 6)}`;
      nodes.push(
        React.createElement(
          Tag as any,
          { key: bi, style: headingStyles[level - 1] },
          renderInline(headingMatch[2], citeMap)
        )
      );
      continue;
    }

    // Default: paragraph
    const parts = trimmed.split("\n");
    nodes.push(
      <p key={bi}>
        {parts.map((part, pi) => (
          <React.Fragment key={pi}>
            {renderInline(part, citeMap)}
            {pi < parts.length - 1 && <br />}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return <>{nodes}</>;
};
