import type { EChartsOption } from 'echarts';
import { useMemo, useRef } from 'react';
import { ChartCard } from '../../components/chart/ChartCard';
import { EChart, type EChartHandle } from '../../components/chart/EChart';
import { resistanceColor, textOn } from '../../components/chart/palette';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/icons';
import { dimNamer, fmtPct } from '../../data/format';
import { useDataset } from '../../data/load';
import { useT } from '../../i18n';
import { compareColors, indicatorShort } from './GlassProfile';
import { glassRows, indicatorCodes } from './glassModel';
import { tipRow, tipTitle, glassSourceLine } from './kit/util';
import { useNarrow } from './kit/hooks';
import k from './kit/kit.module.css';
import s from './GlassCompare.module.css';

interface Props {
  indicator: string;
  countries: string[];
  onRemove?: (iso: string) => void;
  link?: string;
}

/**
 * Explicit "comparison result" block: Taiwan vs the selected countries.
 * (a) grouped bars for the active indicator; (b) a matrix of all indicators × countries,
 * coloured with the resistance ramp, with Taiwan's difference against each country.
 */
export function GlassCompare({ indicator, countries, onRemove, link }: Props) {
  const t = useT();
  const ct = useChartTheme();
  const narrow = useNarrow();
  const ref = useRef<EChartHandle>(null);
  const { data: env, status } = useDataset('glass');
  const nameC = dimNamer(env?.dims?.countries, t.locale);
  const nameI = dimNamer(env?.dims?.indicators, t.locale);
  const set = useMemo(() => ['TWN', ...countries.filter((c) => c !== 'TWN')], [countries]);
  const color = compareColors(set, ct.theme, ct.tokens.ink);

  const model = useMemo(() => {
    if (!env) return null;
    const codes = indicatorCodes(env);
    const rows = glassRows(env.records, {});
    const by = new Map(rows.map((r) => [`${r.iso3}|${r.indicator}`, r]));
    const get = (iso: string, ind: string) => by.get(`${iso}|${ind}`);
    const bars = set
      .map((iso) => ({ iso, rec: get(iso, indicator) }))
      .filter((x) => x.rec)
      .map((x) => ({ iso: x.iso, value: x.rec!.resistant_pct, year: x.rec!.year, source: x.rec!.source }))
      .sort((a, b) => b.value - a.value);
    const matrix = codes.map((ind) => ({
      ind,
      cells: set.map((iso) => {
        const r = get(iso, ind);
        return r ? { iso, value: r.resistant_pct, year: r.year } : { iso, value: null, year: null };
      }),
    }));
    return { codes, bars, matrix, get };
  }, [env, set, indicator]);

  const option = useMemo<EChartsOption>(() => {
    if (!model) return {};
    const tok = ct.tokens;
    const cats = model.bars.map((b) => nameC(b.iso));
    return {
      grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
      xAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: { formatter: '{value}%' },
        splitLine: { lineStyle: { color: tok.line } },
      },
      yAxis: {
        type: 'category',
        data: cats,
        inverse: true,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: { fontWeight: 600 },
      },
      tooltip: {
        trigger: 'item',
        formatter: (p: unknown) => {
          const i = (p as { dataIndex: number }).dataIndex;
          const b = model.bars[i];
          return (
            tipTitle(`${nameC(b.iso)} · ${nameI(indicator)}`) +
            tipRow(color(b.iso), t('international.compare.value'), fmtPct(b.value, t.locale), true) +
            tipRow(undefined, t('international.dataYear'), String(b.year)) +
            tipRow(undefined, t('international.compare.source'), String(b.source))
          );
        },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 26,
          data: model.bars.map((b) => ({
            value: b.value,
            itemStyle: {
              color: color(b.iso),
              borderRadius: [0, 6, 6, 0],
              borderWidth: b.iso === 'TWN' ? 2 : 0,
              borderColor: tok.accent,
            },
          })),
          label: {
            show: true,
            position: 'right',
            formatter: (p: unknown) => fmtPct((p as { value: number }).value, t.locale),
            color: tok.ink,
            fontWeight: 650,
          },
        },
      ],
    };
  }, [model, ct, nameC, nameI, indicator, color, t]);

  const tw = model?.get('TWN', indicator);
  const tableRows = useMemo(
    () =>
      (model?.matrix ?? []).map((row) => {
        const r: Record<string, string | number | null> = { indicator: nameI(row.ind) };
        for (const c of row.cells) r[nameC(c.iso)] = c.value;
        return r;
      }),
    [model, nameI, nameC],
  );

  const others = set.filter((c) => c !== 'TWN');
  const title = t('international.compare.title');
  const subtitle = others.length
    ? t('international.compare.subtitle', { n: others.length, indicator: nameI(indicator) })
    : t('international.compare.subtitleEmpty');

  return (
    <ChartCard
      id="glass-compare"
      title={title}
      subtitle={subtitle}
      source={glassSourceLine(env, t.locale, (n) => t('international.sourceMore', { n }))}
      dataset="glass"
      status={status}
      chartRef={ref}
      tableRows={tableRows}
      fileName={`twamr-glass-compare-${indicator}`.toLowerCase()}
      link={link}
      keyNumber={
        tw && others.length
          ? { value: fmtPct(tw.resistant_pct, t.locale), label: `${nameC('TWN')} · ${nameI(indicator)}` }
          : undefined
      }
      actions={
        <div className={s.chips} aria-label={t('international.compare.selected')}>
          <span className={s.chip} style={{ borderColor: color('TWN') }}>
            <span className={s.dot} style={{ background: color('TWN') }} />
            {nameC('TWN')}
          </span>
          {others.map((iso) => (
            <span key={iso} className={s.chip} style={{ borderColor: color(iso) }}>
              <span className={s.dot} style={{ background: color(iso) }} />
              {nameC(iso)}
              {onRemove && (
                <button
                  type="button"
                  className={s.remove}
                  onClick={() => onRemove(iso)}
                  aria-label={t('international.compare.remove', { country: nameC(iso) })}
                >
                  <Icon name="close" size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      }
    >
      {others.length === 0 ? (
        <EmptyState
          icon="globe"
          title={t('international.compare.emptyTitle')}
          body={t('international.compare.emptyBody')}
        />
      ) : (
        <div className={s.layout}>
          <div className={s.chart}>
            <h4 className={s.h}>{nameI(indicator)}</h4>
            <EChart
              ref={ref}
              option={option}
              height={Math.max(160, set.length * 44 + 40)}
              ariaLabel={t('international.compare.aria', { indicator: nameI(indicator) })}
            />
          </div>
          <div className={`${k.tableWrap} ${s.matrix}`}>
            <h4 className={s.h}>{t('international.compare.matrixTitle')}</h4>
            <table className={`${k.table} ${s.table}`}>
              <thead>
                <tr>
                  <th scope="col">{t('international.indicator')}</th>
                  {set.map((iso) => (
                    <th key={iso} scope="col" className={s.num}>
                      <span className={s.dot} style={{ background: color(iso) }} />
                      {narrow ? iso : nameC(iso)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(model?.matrix ?? []).map((row) => {
                  const twv = row.cells.find((c) => c.iso === 'TWN')?.value ?? null;
                  return (
                    <tr key={row.ind} className={row.ind === indicator ? s.active : undefined}>
                      <th scope="row" title={nameI(row.ind)}>
                        {indicatorShort(env, row.ind)}
                      </th>
                      {row.cells.map((c) => {
                        const fill = c.value == null ? undefined : resistanceColor(c.value, ct.theme);
                        const diff = c.iso !== 'TWN' && c.value != null && twv != null ? twv - c.value : null;
                        return (
                          <td key={c.iso} className={s.num}>
                            {c.value == null ? (
                              <span className={s.na}>—</span>
                            ) : (
                              <span
                                className={s.cell}
                                style={{ background: fill, color: fill ? textOn(fill) : undefined }}
                                title={`${nameC(c.iso)} · ${nameI(row.ind)} · ${c.year}`}
                              >
                                {fmtPct(c.value, t.locale)}
                              </span>
                            )}
                            {diff != null && (
                              <span
                                className={`${s.diff} ${diff > 0 ? s.worse : diff < 0 ? s.better : ''}`}
                                title={t('international.compare.diffTitle', { country: nameC(c.iso) })}
                              >
                                {diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {Math.abs(diff).toFixed(1)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className={k.chartNote}>{t('international.compare.note')}</p>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
