import React from "react";

/**
 * Small Markdown renderer for lesson articles. Builds React elements (never raw HTML),
 * so teacher-written text can't inject markup. Supports headings, paragraphs, lists,
 * fenced code, blockquotes, rules, **bold**, *italic*, `code` and http(s) links.
 */

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[2]) out.push(<strong key={k}>{inline(m[2], k)}</strong>);
    else if (m[3] || m[4]) out.push(<em key={k}>{inline(m[3] ?? m[4], k)}</em>);
    else if (m[5]) out.push(<code key={k} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] text-slate-800">{m[5]}</code>);
    else if (m[6])
      out.push(
        SAFE_URL.test(m[7]) ? (
          <a key={k} href={m[7]} target="_blank" rel="noreferrer noopener" className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800">{m[6]}</a>
        ) : (
          m[6]
        ),
      );
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let n = 0;
  const key = () => `b${n++}`;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(<pre key={key()} className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100"><code>{code.join("\n")}</code></pre>);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const k = key();
      const level = h[1].length;
      const cls = ["", "text-2xl font-semibold", "text-xl font-semibold", "text-lg font-semibold", "text-base font-semibold"][level];
      const Tag = (`h${Math.min(level + 1, 6)}`) as "h2";
      blocks.push(<Tag key={k} className={`${cls} mt-6 text-slate-900 first:mt-0`}>{inline(h[2], k)}</Tag>);
      i++;
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { blocks.push(<hr key={key()} className="my-6 border-slate-200" />); i++; continue; }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) quote.push(lines[i++].replace(/^>\s?/, ""));
      const k = key();
      blocks.push(<blockquote key={k} className="border-l-4 border-brand-200 pl-4 italic text-slate-600">{inline(quote.join(" "), k)}</blockquote>);
      continue;
    }
    const ul = /^\s*[-*+]\s+/;
    const ol = /^\s*\d+[.)]\s+/;
    if (ul.test(line) || ol.test(line)) {
      const ordered = ol.test(line);
      const re = ordered ? ol : ul;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ""));
      const k = key();
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={k} className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-6`}>
          {items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}
        </List>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>|\s*[-*+]\s|\s*\d+[.)]\s)/.test(lines[i])) para.push(lines[i++]);
    const k = key();
    blocks.push(<p key={k}>{inline(para.join(" "), k)}</p>);
  }

  return <div className="space-y-4 leading-7 text-slate-700">{blocks}</div>;
}
