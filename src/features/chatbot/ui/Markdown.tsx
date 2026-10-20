/**
 * Markdown-lite renderer: paragraphs, line breaks, **bold**, `code`, [links](…), bullet
 * and numbered lists. Builds React elements (no innerHTML). Only http(s) and in-app hash
 * links ("#/route?…") become anchors.
 */
import { Fragment, type MouseEvent, type ReactNode } from 'react';
import s from './chat.module.css';

const INLINE = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^)\s]+\)|`[^`\n]+`|https?:\/\/[^\s)）]+)/g;

function safeHref(href: string): string | null {
  if (/^#\//.test(href)) return href;
  if (/^https?:\/\//i.test(href)) return href;
  return null;
}

function inline(text: string, onLink?: (e: MouseEvent<HTMLAnchorElement>, href: string) => void, key = ''): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const tok = m[0];
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const k = `${key}-${i++}`;
    if (tok.startsWith('**')) out.push(<strong key={k}>{inline(tok.slice(2, -2), onLink, k)}</strong>);
    else if (tok.startsWith('`')) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
      const label = lm ? lm[1] : tok;
      const href = safeHref(lm ? lm[2] : tok);
      if (!href) out.push(label);
      else {
        const external = !href.startsWith('#');
        out.push(
          <a
            key={k}
            href={href}
            className={s.mdLink}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            onClick={(e) => onLink?.(e, href)}
          >
            {label}
          </a>,
        );
      }
    }
    last = at + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, onLink }: { text: string; onLink?: (e: MouseEvent<HTMLAnchorElement>, href: string) => void }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <div className={s.md}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim().length);
        if (!lines.length) return null;
        const isBullet = lines.every((l) => /^\s*[-*•]\s+/.test(l));
        const isNum = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
        if (isBullet || isNum) {
          const items = lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ''), onLink, `${bi}-${li}`)}</li>);
          return isNum ? <ol key={bi}>{items}</ol> : <ul key={bi}>{items}</ul>;
        }
        // mixed block: leading paragraph lines then a list
        const firstList = lines.findIndex((l) => /^\s*[-*•]\s+/.test(l));
        if (firstList > 0 && lines.slice(firstList).every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <Fragment key={bi}>
              <p>{lines.slice(0, firstList).flatMap((l, li) => [li ? <br key={`br${li}`} /> : null, ...inline(l.replace(/^#+\s*/, ''), onLink, `${bi}-${li}`)])}</p>
              <ul>
                {lines.slice(firstList).map((l, li) => (
                  <li key={li}>{inline(l.replace(/^\s*[-*•]\s+/, ''), onLink, `${bi}-l${li}`)}</li>
                ))}
              </ul>
            </Fragment>
          );
        }
        const heading = /^#{1,6}\s+/.test(lines[0]);
        return (
          <p key={bi} className={heading ? s.mdHeading : undefined}>
            {lines.flatMap((l, li) => [li ? <br key={`br${li}`} /> : null, ...inline(l.replace(/^#{1,6}\s+/, ''), onLink, `${bi}-${li}`)])}
          </p>
        );
      })}
    </div>
  );
}

/** Strip markdown for copy/share text. */
export function toPlain(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();
}
