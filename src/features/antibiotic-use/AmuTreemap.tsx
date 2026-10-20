import type { EChartsOption } from 'echarts';
import { useMemo, useRef } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { textOn } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { dimNamer, fmtNumber, fmtPct } from '../../data/format';
import { useDataset } from '../../data/load';
import { inYearRange, latestYear, type YearRange } from '../../data/select';
import type { Level } from '../../data/types';
import { useT } from '../../i18n';
import { tipRow, tipTitle, envSourceLine } from '../international/kit/util';
import { useNarrow } from '../international/kit/hooks';
import { AWARE_COLORS, AWARE_ORDER, amuRows, awareOf, classColor, TOTAL } from './amuModel';

/** Treemap of class DID for the latest year in range (area = DID, colour = AWaRe family). */
export function AmuTreemap({ level, years, link }: { level: Level; years?: YearRange; link?: string }) {
  const t = useT();
  const ct = useChartTheme();
  const narrow = useNarrow();
  const ref = useRef<EChartHandle>(null);
  const { data: env, status } = useDataset('antibiotic_use');
  const dims = env?.dims?.classes;
  const nameCls = dimNamer(dims, t.locale);

  const model = useMemo(() => {
    if (!env) return null;
    const rows = amuRows(env.records, level).filter((r) => r.className !== TOTAL && inYearRange(r.year, years));
    const year = latestYear(rows);
    const cur = rows.filter((r) => r.year === year);
    const total = cur.reduce((a, r) => a + r.value, 0);
    return { year, cur, total };
  }, [env, level, years]);

  const height = narrow ? 380 : 420;
  const option = useMemo<EChartsOption>(() => {
    if (!model) return {};
    const tok = ct.tokens;
    const data = AWARE_ORDER.map((aw) => {
      const kids = model.cur.filter((r) => awareOf(dims, r.className) === aw);
      const sum = kids.reduce((a, r) => a + r.value, 0);
      return {
        name: t(`amu.aware.${aw}`),
        value: sum,
        itemStyle: { color: AWARE_COLORS[ct.theme][aw], borderColor: tok.surface, borderWidth: 3, gapWidth: 2 },
        upperLabel: { color: textOn(AWARE_COLORS[ct.theme][aw]) },
        children: kids
          .sort((a, b) => b.value - a.value)
          .map((r) => {
            const c = classColor(dims, r.className, ct.theme);
            return { name: nameCls(r.className), code: r.className, value: r.value, itemStyle: { color: c }, label: { color: textOn(c) } };
          }),
      };
    }).filter((g) => g.value > 0);
    return {
      tooltip: {
        confine: true,
        formatter: (p: unknown) => {
          const pp = p as { name: string; value: number; treePathInfo: { name: string }[] };
          const path = pp.treePathInfo?.map((x) => x.name).filter(Boolean) ?? [];
          return tipTitle(pp.name) + (path.length > 2 ? tipRow(undefined, t('amu.awareLabel'), path[1]) : '') + tipRow(undefined, 'DID', fmtNumber(pp.value, t.locale, { digits: 1 }), true) + tipRow(undefined, t('amu.treemap.share'), fmtPct((pp.value / model.total) * 100, t.locale));
        },
      },
      series: [
        {
          type: 'treemap',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          squareRatio: 0.9,
          data,
          upperLabel: { show: true, height: 22, fontWeight: 650, fontSize: 12, formatter: (p: { name: string; value: number }) => `${p.name} · ${fmtPct((p.value / model.total) * 100, t.locale, 0)}` },
          label: {
            show: true,
            fontSize: 11,
            lineHeight: 15,
            overflow: 'truncate',
            formatter: (p: { name: string; value: number }) => `${p.name}\n${fmtNumber(p.value, t.locale, { digits: 1 })}`,
          },
          itemStyle: { borderColor: tok.surface, borderWidth: 1, gapWidth: 2 },
          levels: [{ itemStyle: { borderWidth: 0, gapWidth: 4 } }, { itemStyle: { gapWidth: 2, borderWidth: 2, borderColor: tok.surface } }, {}],
        },
      ],
    } as EChartsOption;
  }, [model, ct, dims, nameCls, t]);

  const title = t('amu.treemap.title', { year: model?.year ?? '—' });
  return (
    <ChartCard
      id="amu-treemap"
      title={title}
      subtitle={t('amu.treemap.subtitle', { level: t(`levels.${level}`), total: fmtNumber(model?.total, t.locale, { digits: 0 }) })}
      source={envSourceLine(env, t.locale)}
      dataset="antibiotic_use"
      status={status}
      chartRef={ref}
      tableRows={(model?.cur ?? [])
        .slice()
        .sort((a, b) => b.value - a.value)
        .map((r) => ({ [t('amu.class')]: nameCls(r.className), ATC: r.atc, [t('amu.awareLabel')]: t(`amu.aware.${awareOf(dims, r.className)}`), DID: r.value, [t('amu.treemap.share')]: Math.round((r.value / (model?.total || 1)) * 1000) / 10 }))}
      fileName={`twamr-amu-treemap-${level}-${model?.year ?? ''}`}
      link={link}
      height={height}
    >
      <EChart ref={ref} option={option} height={height} ariaLabel={`${title}. ${t('amu.treemap.aria')}`} />
    </ChartCard>
  );
}
