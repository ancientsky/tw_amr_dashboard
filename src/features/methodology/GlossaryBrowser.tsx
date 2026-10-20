import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, Icon, Skeleton } from '../../components/ui';
import { useDataset } from '../../data/load';
import type { GlossaryRecord, LocalizedText } from '../../data/types';
import { useT } from '../../i18n';
import s from './methodology.module.css';

/** The shipped glossary.json localises `term` (types.ts still declares it as string). */
interface Entry extends Omit<GlossaryRecord, 'term'> {
  term: LocalizedText;
  idx: number;
  letter: string;
}

const letterOf = (abbr: string) => {
  const c = abbr.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
};

/** Searchable, alphabetical (by abbreviation), trilingual glossary with related-term chips. */
export function GlossaryBrowser() {
  const t = useT();
  const { status, data } = useDataset('glossary');
  const [query, setQuery] = useState('');
  const [letter, setLetter] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const list = [...((data?.records ?? []) as unknown as Omit<Entry, 'idx' | 'letter'>[])].sort((a, b) =>
      a.abbr.localeCompare(b.abbr, 'en', { sensitivity: 'base', numeric: true }),
    );
    return list.map((r, idx) => ({ ...r, idx, letter: letterOf(r.abbr) }));
  }, [data]);

  const letters = useMemo(
    () =>
      [...new Set(entries.map((e) => e.letter))].sort((a, b) =>
        a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b),
      ),
    [entries],
  );

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (letter && e.letter !== letter) return false;
      if (!needle) return true;
      const hay = [e.abbr, e.term[t.locale], e.term.en, e.term['zh-TW'], e.definition[t.locale]]
        .join(' ')
        .toLowerCase();
      return needle.split(/\s+/).every((w) => hay.includes(w));
    });
  }, [entries, query, letter, t.locale]);

  const byAbbr = useMemo(() => new Map(entries.map((e) => [e.abbr, e])), [entries]);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), 2200);
    return () => window.clearTimeout(id);
  }, [flash]);

  const jump = (abbr: string) => {
    const target = byAbbr.get(abbr);
    if (!target) return;
    setQuery('');
    setLetter(null);
    setFlash(abbr);
    window.requestAnimationFrame(() => {
      const el = box.current?.querySelector<HTMLElement>(`[data-abbr="${CSS.escape(abbr)}"]`);
      if (el && box.current)
        box.current.scrollTo({ top: el.offsetTop - box.current.offsetTop - 8, behavior: 'smooth' });
    });
  };

  if (status === 'loading') return <Skeleton height={320} radius={16} />;
  if (status !== 'ready')
    return <EmptyState icon="alert" title={t('common.error')} body={t('common.errorBody')} />;

  let last = '';
  return (
    <div className={s.glossary}>
      <div className={s.glToolbar}>
        <label className={s.glSearch}>
          <Icon name="search" size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('about.glossary.search')}
            aria-label={t('about.glossary.search')}
            className={s.glInput}
          />
        </label>
        <span className={s.glCount} aria-live="polite">
          {t('about.glossary.count', { n: shown.length, total: entries.length })}
        </span>
      </div>
      <div className={s.letters} role="group" aria-label={t('about.glossary.letters')}>
        <button
          type="button"
          className={s.letter}
          aria-pressed={letter === null}
          onClick={() => setLetter(null)}
        >
          {t('common.all')}
        </button>
        {letters.map((l) => (
          <button
            key={l}
            type="button"
            className={s.letter}
            aria-pressed={letter === l}
            onClick={() => setLetter(letter === l ? null : l)}
          >
            {l}
          </button>
        ))}
      </div>

      <div className={s.glList} ref={box} tabIndex={0} role="region" aria-label={t('about.glossary.title')}>
        {shown.length === 0 && (
          <EmptyState icon="search" title={t('resources.noMatch')} body={t('resources.noMatchBody')} />
        )}
        <div role="list">
          {shown.map((e) => {
            const head = e.letter !== last ? e.letter : null;
            last = e.letter;
            const others = (['zh-TW', 'en', 'ja'] as const)
              .filter((l) => l !== t.locale)
              .map((l) => e.term[l])
              .filter((x, i, a) => x && a.indexOf(x) === i && x !== e.term[t.locale]);
            return (
              <div key={e.idx} role="listitem">
                {head && !query && (
                  <div className={s.glLetter} aria-hidden="true">
                    {head}
                  </div>
                )}
                <div className={[s.glItem, flash === e.abbr ? s.glFlash : ''].join(' ')} data-abbr={e.abbr}>
                  <h3 className={s.glTerm}>
                    <span className={s.glAbbr}>{e.abbr}</span>
                    <span className={s.glName}>{e.term[t.locale] || e.term.en}</span>
                  </h3>
                  {others.length > 0 && <div className={s.glOthers}>{others.join(' · ')}</div>}
                  <p className={s.glDef}>{e.definition[t.locale] || e.definition.en}</p>
                  {e.related.length > 0 && (
                    <div className={s.glRelated}>
                      <span>{t('about.glossary.related')}</span>
                      {e.related.map((r) =>
                        byAbbr.has(r) ? (
                          <button
                            key={r}
                            type="button"
                            className={s.relChip}
                            onClick={() => jump(r)}
                            title={byAbbr.get(r)!.term[t.locale]}
                          >
                            {r}
                          </button>
                        ) : (
                          <span key={r} className={[s.relChip, s.relStatic].join(' ')}>
                            {r}
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
