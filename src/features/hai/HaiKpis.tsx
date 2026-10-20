import { useMemo } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { Kpi } from '../../components/ui/Kpi';
import { dimNamer, fmtNumber } from '../../data/format';
import { useDataset } from '../../data/load';
import { inYearRange, type YearRange } from '../../data/select';
import type { IcuType, Level } from '../../data/types';
import { useT } from '../../i18n';
import { envSourceLine } from '../international/kit/util';
import s from '../antibiotic-use/amu.module.css';
import { KPI_METRICS, haiSeries, unitKey } from './haiModel';

/** KPI row: HAI density, CLABSI, CAUTI, VAP (latest year in range) with deltas + sparklines. */
export function HaiKpis({ level, icu, years, link }: { level: Level; icu: IcuType; years?: YearRange; link?: string }) {
  const t = useT();
  const { data: env, status } = useDataset('hai');
  const nameM = dimNamer(env?.dims?.metrics, t.locale);
  const nameU = dimNamer(env?.dims?.units, t.locale);
  const nameIcu = dimNamer(env?.dims?.icuTypes, t.locale);

  const items = useMemo(() => {
    if (!env) return [];
    return KPI_METRICS.map((m) => {
      const rows = haiSeries(env.records, level, icu, m).filter((r) => inYearRange(r.year, years));
      const cur = rows[rows.length - 1];
      const prev = rows[rows.length - 2];
      return { m, cur, prev, trend: rows.map((r) => r.value) };
    }).filter((x) => x.cur);
  }, [env, level, icu, years]);

  const year = items[0]?.cur?.year;
  const rows = items.map((x) => ({
    [t('hai.metric')]: nameM(x.m),
    [t('common.year')]: x.cur!.year,
    [t('common.value')]: x.cur!.value,
    [t('hai.unit')]: nameU(unitKey(env, x.m)),
    Δ: x.prev ? Math.round((x.cur!.value - x.prev.value) * 100) / 100 : null,
  }));

  return (
    <ChartCard
      id="hai-kpis"
      title={t('hai.kpi.title')}
      subtitle={t('hai.kpi.subtitle', { level: t(`levels.${level}`), icu: nameIcu(icu), year: year ?? '—' })}
      source={envSourceLine(env, t.locale)}
      dataset="hai"
      status={status === 'ready' && !items.length ? 'empty' : status}
      tableRows={rows}
      fileName={`twamr-hai-kpis-${level}-${icu}`}
      link={link}
      keyNumber={items[1]?.cur ? { value: fmtNumber(items[1].cur.value, t.locale, { digits: 2 }), label: `CLABSI · ${items[1].cur.year}` } : undefined}
      toolbar={{ fullscreen: false }}
      height={170}
    >
      <div className={s.kpiGrid}>
        {items.map((x) => (
          <Kpi
            key={x.m}
            label={t(`hai.kpi.${x.m}`)}
            value={x.cur!.value}
            format={(v) => fmtNumber(v, t.locale, { digits: 2 })}
            delta={x.prev ? x.cur!.value - x.prev.value : undefined}
            deltaLabel={x.prev ? t('kpi.vsPrev', { year: x.prev.year }) : undefined}
            trend={x.trend}
            caption={nameU(unitKey(env, x.m))}
          />
        ))}
      </div>
    </ChartCard>
  );
}
