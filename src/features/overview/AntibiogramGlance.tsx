import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChartCard } from '../../components/chart/ChartCard';
import { resistanceColor, resistanceRamp } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { fmtNumber, fmtPct } from '../../data/format';
import { useT } from '../../i18n';
import { HeatGrid, HeatLegend } from '../resistance/HeatGrid';
import { antibiogramMatrix, antibiogramYears } from '../resistance/lib';
import { resistanceSource, useResistanceModel } from '../resistance/model';
import s from './overview.module.css';

export const GLANCE_PATHOGENS = ['SAU', 'EFM', 'ECO', 'KPN', 'PAE', 'ABA'];
export const GLANCE_ANTIBIOTICS = ['OXA', 'VAN', 'CRO', 'CAZ', 'FEP', 'TZP', 'MEM', 'CIP', 'AMK', 'SXT', 'TGC'];

/** Compact antibiogram: 6 key pathogens × 11 key agents, national, latest year. */
export function AntibiogramGlance() {
  const t = useT();
  const ct = useChartTheme();
  const nav = useNavigate();
  const { env, ab, names, status, isFixture } = useResistanceModel();
  const year = ab ? antibiogramYears(ab).at(-1) : undefined;
  const m = useMemo(() => (ab && year ? antibiogramMatrix(ab, year, 'all', env?.dims, { pathogens: GLANCE_PATHOGENS, antibiotics: GLANCE_ANTIBIOTICS }) : null), [ab, year, env]);
  const cols = GLANCE_ANTIBIOTICS.map((a) => ({ code: a, label: a, title: names.antibiotic(a) }));
  const rows = GLANCE_PATHOGENS.map((p) => ({ code: p, label: names.pathogenShort(p), title: names.pathogen(p), italic: t.locale === 'en' }));
  const tableRows = useMemo(
    () =>
      m
        ? GLANCE_PATHOGENS.map((p) => {
            const row: Record<string, string | number | null> = { [t('common.pathogen')]: names.pathogen(p) };
            for (const a of GLANCE_ANTIBIOTICS) row[a] = m.get(p, a)?.resistant_pct ?? null;
            return row;
          })
        : undefined,
    [m, names, t],
  );
  const title = t('overview.glance.title');
  const color = (v: number) => resistanceColor(v, ct.theme);

  return (
    <ChartCard
      id="overview-antibiogram"
      eyebrow={t('overview.glance.eyebrow')}
      title={title}
      subtitle={t('overview.glance.subtitle', { year: year ?? '—' })}
      source={resistanceSource(env, t.locale)}
      dataset="resistance"
      isFixture={isFixture}
      precision="table"
      status={status}
      tableRows={tableRows}
      fileName={`twamr-antibiogram-glance-${year ?? ''}`}
      embed={{ chart: 'resistance-heatmap' }}
      height={320}
      footer={
        <a className={s.footLink} href="#/resistance?view=antibiogram">
          {t('overview.glance.openExplorer')} →
        </a>
      }
    >
      {m && (
        <>
          <HeatGrid
            rows={rows}
            cols={cols}
            cell={(p, a) => {
              const r = m.get(p, a);
              return r ? { value: r.resistant_pct } : undefined;
            }}
            color={color}
            onCellClick={(p, a) => nav(`/resistance?view=pathogen&pathogen=${p}&antibiotic=${a}`)}
            tooltip={(p, a) => {
              const r = m.get(p, a);
              return (
                <>
                  <div className={s.tipValue}>{fmtPct(r?.resistant_pct, t.locale)}</div>
                  <div>
                    <i>{names.pathogen(p)}</i> × {names.antibiotic(a)}
                  </div>
                  <div className={s.tipMuted}>
                    {t('common.isolates')}: {fmtNumber(r?.isolates, t.locale)}
                  </div>
                </>
              );
            }}
            caption={title}
            cellSize={38}
            rowHeader={132}
            emptyLabel={t('overview.glance.notReported')}
          />
          <HeatLegend title={t('resistance.antibiogram.legend')} stops={resistanceRamp(9, ct.theme)} labels={['0%', '50%', '100%']} />
        </>
      )}
    </ChartCard>
  );
}
