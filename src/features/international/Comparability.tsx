import { useMemo } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { PrecisionBadge } from '../../components/chart/badges';
import { Badge } from '../../components/ui/Badge';
import { dimNamer } from '../../data/format';
import { useDataset } from '../../data/load';
import type { Precision } from '../../data/types';
import { useT } from '../../i18n';
import { glassSourceLine } from './kit/util';
import { indicatorShort } from './GlassProfile';
import { glassMeta, indicatorCodes } from './glassModel';
import k from './kit/kit.module.css';

const DIFF_ROWS = [
  'system',
  'scope',
  'specimen',
  'unit',
  'measure',
  'breakpoints',
  'network',
  'years',
  'precision',
] as const;
const CAVEATS = ['member', 'breakpoints', 'unit', 'nonsusceptible', 'curated'] as const;

/** Methodological differences GLASS vs THAS + how each Taiwan value was derived (from glass.meta.comparability). */
export function Comparability({ link }: { link?: string }) {
  const t = useT();
  const { data: env, status } = useDataset('glass');
  const nameI = dimNamer(env?.dims?.indicators, t.locale);
  const twn = useMemo(() => glassMeta(env).comparability?.TWN ?? {}, [env]);

  const diffRows = useMemo(
    () =>
      DIFF_ROWS.map((r) => ({
        [t('international.comp.aspect')]: t(`international.comp.rows.${r}.label`),
        'WHO GLASS': t(`international.comp.rows.${r}.glass`),
        [t('international.comp.thasCol')]: t(`international.comp.rows.${r}.thas`),
      })),
    [t],
  );

  const derivRows = useMemo(() => {
    const codes = indicatorCodes(env);
    return codes.map((c) => {
      const d = twn[c] ?? {};
      return {
        code: c,
        d,
        row: {
          [t('international.indicator')]: nameI(c),
          [t('international.comp.basis')]:
            d.pathogen && d.antibiotic ? `${d.pathogen} × ${d.antibiotic}` : (d.phenotype ?? '—'),
          [t('international.comp.tier')]: d.tier ? t(`international.comp.tiers.${d.tier}`) : '—',
          [t('common.specimen')]: d.specimen ? t(`specimens.${d.specimen}`) : '—',
          [t('common.year')]: d.year ?? null,
          [t('precision.label')]: d.precision ? t(`precision.${d.precision}`) : '—',
          [t('international.comp.fallback')]: d.fallback
            ? t('international.comp.yes')
            : t('international.comp.no'),
        },
      };
    });
  }, [env, twn, t, nameI]);

  const src = glassSourceLine(env, t.locale, (n) => t('international.sourceMore', { n }));
  return (
    <div className={k.stack}>
      <ChartCard
        id="glass-methods"
        title={t('international.comp.title')}
        subtitle={t('international.comp.subtitle')}
        source={src}
        dataset="glass"
        status={status}
        tableRows={diffRows}
        fileName="twamr-glass-vs-thas-methods"
        link={link}
        toolbar={{ fullscreen: false }}
        height={300}
      >
        <div className={k.tableWrap}>
          <table className={`${k.table} ${k.stackTable}`}>
            <thead>
              <tr>
                <th scope="col">{t('international.comp.aspect')}</th>
                <th scope="col">WHO GLASS</th>
                <th scope="col">{t('international.comp.thasCol')}</th>
              </tr>
            </thead>
            <tbody>
              {DIFF_ROWS.map((r) => (
                <tr key={r}>
                  <th scope="row">{t(`international.comp.rows.${r}.label`)}</th>
                  <td data-label="WHO GLASS">{t(`international.comp.rows.${r}.glass`)}</td>
                  <td data-label={t('international.comp.thasCol')}>
                    {t(`international.comp.rows.${r}.thas`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={k.chartNote} style={{ display: 'block' }}>
          <strong style={{ color: 'var(--ink-2)' }}>{t('international.comp.caveatsTitle')}</strong>
          <ul
            style={{ paddingLeft: '1.2em', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            {CAVEATS.map((c) => (
              <li key={c}>{t(`international.comp.caveats.${c}`)}</li>
            ))}
          </ul>
        </div>
      </ChartCard>
      <ChartCard
        id="glass-derivation"
        title={t('international.comp.derivTitle')}
        subtitle={t('international.comp.derivSubtitle')}
        source={src}
        dataset="glass"
        status={status}
        tableRows={derivRows.map((x) => x.row)}
        fileName="twamr-glass-taiwan-derivation"
        link={link}
        toolbar={{ fullscreen: false }}
        height={300}
      >
        <div className={k.tableWrap}>
          <table className={`${k.table} ${k.stackTable}`}>
            <thead>
              <tr>
                <th scope="col">{t('international.indicator')}</th>
                <th scope="col">{t('international.comp.basis')}</th>
                <th scope="col">{t('international.comp.tier')}</th>
                <th scope="col">{t('common.year')}</th>
                <th scope="col">{t('precision.label')}</th>
              </tr>
            </thead>
            <tbody>
              {derivRows.map(({ code, d }) => (
                <tr key={code}>
                  <th scope="row" title={nameI(code)}>
                    {indicatorShort(env, code)}
                  </th>
                  <td className={k.num} data-label={t('international.comp.basis')}>
                    {d.pathogen && d.antibiotic ? `${d.pathogen} × ${d.antibiotic}` : (d.phenotype ?? '—')}
                  </td>
                  <td data-label={t('international.comp.tier')}>
                    {d.tier ? t(`international.comp.tiers.${d.tier}`) : '—'}
                    {d.fallback && (
                      <>
                        {' '}
                        <Badge tone="warn">{t('international.comp.fallback')}</Badge>
                      </>
                    )}
                  </td>
                  <td className={k.num} data-label={t('common.year')}>
                    {d.year ?? '—'}
                  </td>
                  <td data-label={t('precision.label')}>
                    {d.precision ? <PrecisionBadge precision={d.precision as Precision} showExact /> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
