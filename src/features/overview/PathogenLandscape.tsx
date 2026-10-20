import type { EChartsOption } from 'echarts';
import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { MUTED, resistanceColor, textOn } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { useDataset } from '../../data/load';
import { fmtNumber, fmtPct, localized } from '../../data/format';
import type { WhoPriority } from '../../data/types';
import { useT } from '../../i18n';
import { antibiogramYears, isolateTotals, ISOLATE_TO_PATHOGEN } from '../resistance/lib';
import { resistanceSource, useResistanceModel } from '../resistance/model';
import s from './overview.module.css';

const esc = (x: string) => x.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]!);

/** WHO BPPL priority → fill (ordinal steps of the semantic heat ramp; unlisted = muted). */
export function priorityColor(p: WhoPriority | null | undefined, theme: 'light' | 'dark'): string {
  if (p === 'critical') return resistanceColor(96, theme);
  if (p === 'high') return resistanceColor(70, theme);
  if (p === 'medium') return resistanceColor(48, theme);
  return MUTED[theme];
}

export function PathogenLandscape() {
  const t = useT();
  const ct = useChartTheme();
  const nav = useNavigate();
  const ref = useRef<EChartHandle>(null);
  const iso = useDataset('isolates');
  const { ab, names } = useResistanceModel();

  const model = useMemo(() => {
    const recs = iso.data?.records ?? [];
    const all = isolateTotals(recs, { scope: 'all' });
    const year = Math.max(0, ...all.map((r) => r.year));
    const rows = all.filter((r) => r.year === year && r.organism !== 'TOTAL');
    const total = all.find((r) => r.year === year && r.organism === 'TOTAL')?.isolates ?? rows.reduce((a, b) => a + b.isolates, 0);
    const dims = iso.data?.dims?.organisms ?? [];
    const abYear = ab ? antibiogramYears(ab).filter((y) => y <= year).at(-1) : undefined;
    const items = rows
      .sort((a, b) => (a.organism === 'OTHER' ? 1 : b.organism === 'OTHER' ? -1 : b.isolates - a.isolates))
      .map((r) => {
        const d = dims.find((x) => x.code === r.organism);
        const pr = (d?.meta?.whoPriority ?? null) as WhoPriority | null;
        const pathogen = ISOLATE_TO_PATHOGEN[r.organism] ?? r.organism;
        const top =
          ab && abYear
            ? [...ab.values()]
                .filter((x) => x.year === abYear && x.level === 'all' && x.pathogen === pathogen)
                .sort((a, b) => b.resistant_pct - a.resistant_pct)
                .slice(0, 3)
            : [];
        return {
          code: r.organism,
          pathogen,
          name: d ? localized(d.name, t.locale) : r.organism,
          short: d && typeof d.meta?.short === 'string' && t.locale === 'en' ? (d.meta.short as string) : d ? localized(d.name, t.locale) : r.organism,
          value: r.isolates,
          share: total ? (r.isolates / total) * 100 : 0,
          priority: pr,
          top,
        };
      });
    return { year, total, items, abYear, precision: rows };
  }, [iso.data, ab, t.locale]);

  const option = useMemo<EChartsOption>(() => {
    const k = ct.tokens;
    return {
      tooltip: {
        formatter: (p: unknown) => {
          const it = model.items.find((x) => x.code === (p as { data?: { code?: string } }).data?.code);
          if (!it) return '';
          const top = it.top.length
            ? `<div style="margin-top:6px;font-weight:650">${esc(t('overview.landscape.topNs', { year: model.abYear ?? '' }))}</div>${it.top
                .map((r) => `<div style="display:flex;justify-content:space-between;gap:14px"><span>${esc(names.antibiotic(r.antibiotic))}</span><b>${fmtPct(r.resistant_pct, t.locale)}</b></div>`)
                .join('')}`
            : '';
          return `<div style="font-weight:700"><i>${esc(it.name)}</i></div>
            <div>${esc(t('common.isolates'))}: <b>${fmtNumber(it.value, t.locale)}</b> · ${fmtPct(it.share, t.locale)}</div>
            ${it.priority ? `<div style="opacity:.75">${esc(t('overview.landscape.who', { p: t(`resistance.priority.${it.priority}`) }))}</div>` : ''}${top}`;
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
          itemStyle: { borderColor: k.surface, borderWidth: 2, gapWidth: 2, borderRadius: 6 },
          label: {
            show: true,
            formatter: (p: { name: string; value: number; data: { share: number } }) => `{n|${p.name}}\n{v|${fmtNumber(p.value, t.locale, { compact: true })} · ${fmtPct(p.data.share, t.locale, 0)}}`,
            rich: { n: { fontSize: 13, fontWeight: 700, lineHeight: 18 }, v: { fontSize: 11.5, lineHeight: 16, opacity: 0.85 } },
            overflow: 'truncate',
          },
          upperLabel: { show: false },
          data: model.items.map((it) => {
            const fill = priorityColor(it.priority, ct.theme);
            return {
              name: it.short,
              code: it.code,
              value: it.value,
              share: it.share,
              itemStyle: { color: fill },
              label: { color: textOn(fill), fontStyle: t.locale === 'en' && !/spp\.|Other/.test(it.short) ? 'italic' : 'normal' },
            };
          }),
        },
      ],
    } as EChartsOption;
  }, [model, ct.tokens, ct.theme, t, names]);

  const onEvents = useMemo(
    () => ({
      click: (p: unknown) => {
        const code = (p as { data?: { code?: string } }).data?.code;
        const it = model.items.find((x) => x.code === code);
        if (it && it.code !== 'OTHER') nav(`/resistance?view=pathogen&pathogen=${it.pathogen}`);
      },
    }),
    [model, nav],
  );

  const tableRows = model.items.map((it) => ({
    [t('common.pathogen')]: it.name,
    [t('common.isolates')]: it.value,
    '%': Math.round(it.share * 10) / 10,
    WHO: it.priority ? t(`resistance.priority.${it.priority}`) : '—',
  }));
  const title = t('overview.landscape.title');
  const lead = model.items[0];
  return (
    <ChartCard
      id="overview-landscape"
      eyebrow={t('overview.landscape.eyebrow')}
      title={title}
      subtitle={t('overview.landscape.subtitle', { year: model.year || '—', total: fmtNumber(model.total, t.locale) })}
      source={resistanceSource(iso.data, t.locale)}
      dataset="isolates"
      precision={model.precision}
      status={iso.status === 'ready' && model.items.length === 0 ? 'empty' : iso.status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-isolates-landscape-${model.year}`}
      keyNumber={lead ? { value: fmtPct(lead.share, t.locale, 0), label: t('overview.landscape.keyLabel', { pathogen: lead.short, year: model.year }) } : undefined}
      height={400}
      footer={
        <ul className={s.legend}>
          {(['critical', 'high', 'medium'] as WhoPriority[]).map((p) => (
            <li key={p}>
              <span className={s.legendSwatch} style={{ background: priorityColor(p, ct.theme) }} />
              {t('overview.landscape.who', { p: t(`resistance.priority.${p}`) })}
            </li>
          ))}
          <li>
            <span className={s.legendSwatch} style={{ background: MUTED[ct.theme] }} />
            {t('overview.landscape.unlisted')}
          </li>
        </ul>
      }
    >
      <EChart ref={ref} option={option} height={400} onEvents={onEvents} ariaLabel={`${title}. ${t('overview.landscape.aria')}`} />
    </ChartCard>
  );
}
