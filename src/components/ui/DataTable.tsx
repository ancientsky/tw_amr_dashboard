import { useMemo, useState, type ReactNode } from 'react';
import { useT } from '../../i18n';
import { fmtNumber } from '../../data/format';
import { downloadCsv } from '../../lib/download';
import { Button } from './IconButton';
import { Icon } from './icons';
import s from './DataTable.module.css';

export type Row = Record<string, string | number | null | undefined>;

export interface Column<R extends Row = Row> {
  key: keyof R & string;
  label: string;
  /** numeric columns right-align and sort numerically (auto-detected when omitted) */
  numeric?: boolean;
  format?: (v: R[keyof R], row: R) => ReactNode;
}

export interface DataTableProps<R extends Row = Row> {
  rows: readonly R[];
  columns?: readonly Column<R>[];
  /** caption (visually hidden by default) — used for a11y and CSV file name */
  caption: string;
  showCaption?: boolean;
  /** CSV file name (without extension); hides the export button when false */
  csvName?: string | false;
  maxHeight?: number;
  className?: string;
}

/** Sortable, accessible data table with CSV export (the chart's table-view twin). */
export function DataTable<R extends Row = Row>({ rows, columns, caption, showCaption, csvName, maxHeight, className }: DataTableProps<R>) {
  const t = useT();
  const cols = useMemo<readonly Column<R>[]>(() => {
    if (columns) return columns;
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    return keys.map((k) => ({ key: k as keyof R & string, label: k }));
  }, [columns, rows]);

  const numericCols = useMemo(() => {
    const m = new Set<string>();
    for (const c of cols) {
      if (c.numeric ?? rows.every((r) => r[c.key] === null || r[c.key] === undefined || typeof r[c.key] === 'number')) m.add(c.key);
    }
    return m;
  }, [cols, rows]);

  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const num = numericCols.has(sort.key);
    return [...rows].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (num ? Number(x) - Number(y) : String(x).localeCompare(String(y), t.locale)) * sort.dir;
    });
  }, [rows, sort, numericCols, t.locale]);

  const onSort = (key: string) =>
    setSort((cur) => (!cur || cur.key !== key ? { key, dir: 1 } : cur.dir === 1 ? { key, dir: -1 } : null));

  const exportCsv = () => {
    const out = rows.map((r) => Object.fromEntries(cols.map((c) => [c.label, r[c.key] ?? ''])));
    downloadCsv(out, csvName || caption);
  };

  return (
    <div className={[s.wrap, className].filter(Boolean).join(' ')}>
      {csvName !== false && (
        <div className={s.bar}>
          <span>{t('table.rows', { n: rows.length })}</span>
          <Button variant="ghost" icon="download" onClick={exportCsv}>
            {t('table.exportCsv')}
          </Button>
        </div>
      )}
      <div className={s.scroller} style={maxHeight ? { maxHeight } : undefined} tabIndex={0} role="region" aria-label={t('table.caption', { title: caption })}>
        <table className={s.table}>
          <caption className={showCaption ? undefined : 'sr-only'}>{t('table.caption', { title: caption })}</caption>
          <thead>
            <tr>
              {cols.map((c) => {
                const num = numericCols.has(c.key);
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={[s.th, num ? s.num : '', active ? s.sorted : ''].join(' ')}
                    aria-sort={active ? (sort!.dir === 1 ? 'ascending' : 'descending') : 'none'}
                  >
                    <button type="button" className={s.sortBtn} onClick={() => onSort(c.key)} title={t('table.sortBy', { col: c.label })}>
                      {c.label}
                      <Icon className={s.sortIcon} name={active ? (sort!.dir === 1 ? 'arrow-up' : 'arrow-down') : 'sort'} size={12} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td className={s.empty} colSpan={cols.length}>
                  {t('table.empty')}
                </td>
              </tr>
            ) : (
              sorted.map((r, i) => (
                <tr key={i}>
                  {cols.map((c, j) => {
                    const v = r[c.key];
                    const num = numericCols.has(c.key);
                    const content = c.format ? c.format(v, r) : num && typeof v === 'number' ? (c.key === 'year' ? v : fmtNumber(v, t.locale)) : (v ?? '—');
                    return j === 0 ? (
                      <th key={c.key} scope="row" className={[s.td, num ? s.num : ''].join(' ')} style={{ fontWeight: 550 }}>
                        {content}
                      </th>
                    ) : (
                      <td key={c.key} className={[s.td, num ? s.num : ''].join(' ')}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
