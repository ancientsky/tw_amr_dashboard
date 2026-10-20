import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { textOn } from '../../components/chart/palette';
import s from './heat.module.css';

export interface HeatRow {
  code: string;
  label: string;
  title?: string;
  italic?: boolean;
}
export interface HeatCol {
  code: string;
  label: string;
  title?: string;
}
export interface HeatCell {
  value: number | null;
  /** text inside the cell (default: rounded value) */
  display?: string;
}

export interface HeatGridProps {
  rows: readonly HeatRow[];
  cols: readonly HeatCol[];
  cell: (row: string, col: string) => HeatCell | undefined;
  color: (v: number) => string;
  /** grouped column header (consecutive runs) */
  groups?: readonly { label: string; span: number }[];
  onCellClick?: (row: string, col: string) => void;
  tooltip?: (row: string, col: string, cell: HeatCell) => ReactNode;
  /** accessible caption */
  caption: string;
  cellSize?: number;
  /** row header width (px) */
  rowHeader?: number;
  emptyLabel?: string;
  className?: string;
}

interface Tip {
  x: number;
  y: number;
  content: ReactNode;
}

/**
 * Accessible HTML heatmap (a real <table>): sticky row headers, optional class-grouped
 * column header, keyboard-focusable clickable cells, floating tooltip. Cells carry their
 * value as text (ink/white by fill luminance) so colour is never the only channel.
 */
export function HeatGrid({ rows, cols, cell, color, groups, onCellClick, tooltip, caption, cellSize = 30, rowHeader = 168, emptyLabel = '—', className }: HeatGridProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const show = useCallback(
    (el: HTMLElement, r: string, c: string, v: HeatCell) => {
      if (!tooltip || !wrap.current) return;
      const box = wrap.current.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      setTip({ x: b.left - box.left + b.width / 2, y: b.top - box.top, content: tooltip(r, c, v) });
    },
    [tooltip],
  );

  const style = { '--cell': `${cellSize}px`, '--row-head': `${rowHeader}px` } as CSSProperties;

  return (
    <div className={[s.wrap, className].filter(Boolean).join(' ')} ref={wrap} style={style} onPointerLeave={() => setTip(null)}>
      <div className={s.scroller}>
        <table className={s.table}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            {groups && groups.length > 0 && (
              <tr className={s.groupRow}>
                <th className={s.corner} aria-hidden="true" />
                {groups.map((g, i) => (
                  <th key={i} colSpan={g.span} scope="colgroup" className={s.group} title={g.label}>
                    <span>{g.label}</span>
                  </th>
                ))}
              </tr>
            )}
            <tr>
              <th className={s.corner} aria-hidden="true" />
              {cols.map((c) => (
                <th key={c.code} scope="col" className={s.colHead} title={c.title ?? c.label}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <th scope="row" className={[s.rowHead, r.italic ? s.italic : ''].join(' ')} title={r.title ?? r.label}>
                  {r.label}
                </th>
                {cols.map((c) => {
                  const v = cell(r.code, c.code);
                  if (!v || v.value === null) {
                    return (
                      <td key={c.code} className={s.empty}>
                        <span aria-label={emptyLabel}>·</span>
                      </td>
                    );
                  }
                  const fill = color(v.value);
                  const text = v.display ?? (Math.abs(v.value) >= 10 ? Math.round(v.value).toString() : v.value.toFixed(1));
                  const label = `${r.label} × ${c.title ?? c.label}: ${text}`;
                  const inner = (
                    <span className={s.fill} style={{ background: fill, color: textOn(fill) }}>
                      {text}
                    </span>
                  );
                  return (
                    <td key={c.code} className={s.cell}>
                      {onCellClick ? (
                        <button
                          type="button"
                          className={s.btn}
                          aria-label={label}
                          onClick={() => onCellClick(r.code, c.code)}
                          onPointerEnter={(e) => show(e.currentTarget, r.code, c.code, v)}
                          onFocus={(e) => show(e.currentTarget, r.code, c.code, v)}
                          onBlur={() => setTip(null)}
                        >
                          {inner}
                        </button>
                      ) : (
                        <span className={s.btn} aria-label={label} onPointerEnter={(e) => show(e.currentTarget, r.code, c.code, v)}>
                          {inner}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tip && (
        <div className={s.tip} style={{ left: tip.x, top: tip.y }} role="tooltip">
          {tip.content}
        </div>
      )}
    </div>
  );
}

/** Horizontal colour-scale legend for a heatmap. */
export function HeatLegend({ stops, labels, title }: { stops: string[]; labels: string[]; title?: string }) {
  return (
    <div className={s.legend} aria-hidden="true">
      {title && <span className={s.legendTitle}>{title}</span>}
      <div className={s.legendScale}>
        <div className={s.legendBar} style={{ background: `linear-gradient(90deg, ${stops.join(',')})` }} />
        <div className={s.legendTicks}>
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
