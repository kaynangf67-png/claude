import { Fragment, type ReactNode } from 'react';

/** Inline: **negrito** e _itálico_. Gera elementos React (sem HTML cru). */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    out.push(token.startsWith('**') ? <strong key={i++}>{token.slice(2, -2)}</strong> : <em key={i++}>{token.slice(1, -1)}</em>);
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const LIST_RE = /^\s*([-*]|\d+\.)\s+/;

/** Markdown mínimo (parágrafos, listas, negrito) para respostas da IA. */
export function Markdown({ text }: { text: string }) {
  // Agrupa linhas consecutivas do mesmo tipo (lista x texto), mesmo dentro de um bloco.
  const groups: { list: boolean; ordered: boolean; lines: string[] }[] = [];
  for (const block of text.trim().split(/\n{2,}/)) {
    let current: (typeof groups)[number] | null = null;
    for (const line of block.split('\n')) {
      const isList = LIST_RE.test(line);
      if (!current || current.list !== isList) {
        current = { list: isList, ordered: isList && /^\s*\d+\./.test(line), lines: [] };
        groups.push(current);
      }
      current.lines.push(isList ? line.replace(LIST_RE, '') : line);
    }
  }
  return (
    <div className="grid gap-2.5 text-sm leading-relaxed">
      {groups.map((g, gi) =>
        g.list ? (
          g.ordered ? (
            <ol key={gi} className="list-decimal space-y-1 pl-5">{g.lines.map((l, li) => <li key={li}>{inline(l)}</li>)}</ol>
          ) : (
            <ul key={gi} className="list-disc space-y-1 pl-5">{g.lines.map((l, li) => <li key={li}>{inline(l)}</li>)}</ul>
          )
        ) : (
          <p key={gi}>
            {g.lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
