import { useState } from 'react';
import { useT } from '../../i18n';
import s from './dataApi.module.css';

const MAX_ITEMS = 50;

function Scalar({ v }: { v: string | number | boolean | null }) {
  if (v === null) return <span className={s.jNull}>null</span>;
  if (typeof v === 'string')
    return <span className={s.jStr}>{JSON.stringify(v.length > 240 ? v.slice(0, 240) + '…' : v)}</span>;
  if (typeof v === 'number') return <span className={s.jNum}>{String(v)}</span>;
  return <span className={s.jBool}>{String(v)}</span>;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function summary(v: unknown): string {
  if (Array.isArray(v)) return `[${v.length}]`;
  if (isObj(v)) return `{${Object.keys(v).length}}`;
  return '';
}

/** One-line preview of a small object (used for collapsed record rows). */
function preview(v: unknown): string {
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (isObj(v)) {
    const keys = Object.keys(v);
    const shown = keys.slice(0, 4).map((k) => {
      const x = v[k];
      return `${k}: ${typeof x === 'object' && x !== null ? summary(x) : typeof x === 'string' ? JSON.stringify(x.slice(0, 18)) : String(x)}`;
    });
    return `{ ${shown.join(', ')}${keys.length > 4 ? ', …' : ''} }`;
  }
  return '';
}

function Node({
  name,
  value,
  depth,
  openDepth,
}: {
  name?: string;
  value: unknown;
  depth: number;
  openDepth: number;
}) {
  const t = useT();
  const container = Array.isArray(value) || isObj(value);
  const [open, setOpen] = useState(depth < openDepth);
  const label = name !== undefined && <span className={s.jKey}>{name}: </span>;
  if (!container) {
    return (
      <div className={s.jRow}>
        {label}
        <Scalar v={value as string | number | boolean | null} />
      </div>
    );
  }
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.slice(0, MAX_ITEMS).map((x, i) => [String(i), x])
    : Object.entries(value as Record<string, unknown>);
  const more = Array.isArray(value) && value.length > MAX_ITEMS ? value.length - MAX_ITEMS : 0;
  return (
    <div className={s.jBranch}>
      <button type="button" className={s.jToggle} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={[s.jCaret, open ? s.jCaretOpen : ''].join(' ')} aria-hidden="true">
          ▸
        </span>
        {label}
        <span className={s.jMeta}>{open ? summary(value) : preview(value)}</span>
      </button>
      {open && (
        <div className={s.jChildren}>
          {entries.map(([k, v]) => (
            <Node
              key={k}
              name={Array.isArray(value) ? undefined : k}
              value={v}
              depth={depth + 1}
              openDepth={openDepth}
            />
          ))}
          {more > 0 && <div className={s.jMore}>{t('data.api.moreItems', { n: more })}</div>}
        </div>
      )}
    </div>
  );
}

/** Collapsible JSON viewer; arrays are cut at the first 50 items. */
export function JsonTree({ value, openDepth = 2 }: { value: unknown; openDepth?: number }) {
  return (
    <div className={s.json} role="group" aria-label="JSON">
      <Node value={value} depth={0} openDepth={openDepth} />
    </div>
  );
}
