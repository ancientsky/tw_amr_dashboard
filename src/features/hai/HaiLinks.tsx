import { useMemo } from 'react';
import { useChartTheme } from '../../components/chart/useChartTheme';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/icons';
import { dimNamer, fmtPct } from '../../data/format';
import { useDataset } from '../../data/load';
import { latestValue } from '../../data/select';
import type { Level } from '../../data/types';
import { useT } from '../../i18n';
import { organismColors, organismShort, pathogenLevel } from './haiModel';
import s from './hai.module.css';

/** "Which of these organisms are resistant?" — deep links to #/resistance for the top HAI organisms. */
export function HaiLinks({ level: lvl }: { level: Level }) {
  const t = useT();
  const ct = useChartTheme();
  const hp = useDataset('hai_pathogens');
  const res = useDataset('resistance');
  const level = pathogenLevel(hp.data, lvl);
  const nameP = dimNamer(hp.data?.dims?.pathogens, t.locale);
  const color = useMemo(() => organismColors(hp.data, ct.theme), [hp.data, ct.theme]);

  const items = useMemo(() => {
    if (!hp.data) return [];
    const rows = hp.data.records.filter((r) => r.level === level && r.site === 'all');
    const year = Math.max(...rows.map((r) => r.year));
    const resCodes = new Set((res.data?.dims?.pathogens ?? []).map((p) => p.code));
    return rows
      .filter((r) => r.year === year)
      .sort((a, b) => a.rank - b.rank)
      .map((r) => {
        const dim = hp.data!.dims?.pathogens?.find((p) => p.code === r.pathogen);
        const pheno = dim?.meta?.keyPhenotype as string | undefined;
        const lv =
          pheno && res.data
            ? latestValue(res.data.records, (x) => x.phenotype === pheno && x.level === 'all' && (x.setting ?? 'all') === 'all' && x.specimen === 'all' && x.ward === 'all')
            : undefined;
        return { ...r, pheno, lv, inThas: resCodes.size ? resCodes.has(r.pathogen) : true };
      });
  }, [hp.data, res.data, level]);

  const namePh = dimNamer(res.data?.dims?.phenotypes, t.locale);
  return (
    <div className={s.links}>
      {items.map((x) => (
        <div key={x.pathogen} className={s.linkCard}>
          <div className={s.linkHead}>
            <span className={s.rank}>#{x.rank}</span>
            <span className={s.dot} style={{ background: color(x.pathogen) }} aria-hidden="true" />
            <span className={s.org}>
              <span className={s.orgName}>{nameP(x.pathogen)}</span>
              <span className={s.orgShare}>{t('hai.links.share', { pct: fmtPct(x.pct, t.locale) })}</span>
            </span>
          </div>
          {x.pheno && x.lv ? (
            <div className={s.pheno}>
              <Badge tone="danger">{x.pheno}</Badge>
              <span>{t('hai.links.pheno', { value: fmtPct(x.lv.value, t.locale), year: x.lv.year })}</span>
            </div>
          ) : (
            <div className={s.pheno}>
              <span className={s.muted}>{x.inThas ? t('hai.links.noPheno') : t('hai.links.notInThas')}</span>
            </div>
          )}
          {x.inThas ? (
            <a className={s.linkBtn} href={`#/resistance?pathogen=${encodeURIComponent(x.pathogen)}`} title={x.pheno ? namePh(x.pheno) : undefined}>
              {t('hai.links.cta', { org: organismShort(hp.data, x.pathogen, nameP(x.pathogen)) })}
              <Icon name="chevron-right" size={14} />
            </a>
          ) : (
            <span className={`${s.linkBtn} ${s.linkDisabled}`} aria-disabled="true">
              {t('hai.links.unavailable')}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
