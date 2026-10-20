import { useMemo } from 'react';
import { useMeta } from '../../app/providers/DataProvider';
import { REPO_URL, SITE_URL } from '../../app/url';
import { Badge, Icon } from '../../components/ui';
import { localized } from '../../data/format';
import type { SourceRef } from '../../data/types';
import { useT } from '../../i18n';
import { CodeBlock } from './CodeBlock';
import s from './dataApi.module.css';

const FALLBACK_YEARS = [2022, 2023, 2024];

export function CitationBox() {
  const t = useT();
  const { meta } = useMeta();
  const year = useMemo(() => {
    const d = meta?.lastBuild ? new Date(meta.lastBuild) : new Date();
    return Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
  }, [meta]);
  const accessed = new Date().toISOString().slice(0, 10);

  const reports = useMemo<SourceRef[]>(() => {
    const fromMeta = (meta?.sources ?? []).filter((x) => x.id.startsWith('tw-cdc-amr-'));
    if (fromMeta.length) return fromMeta;
    return FALLBACK_YEARS.map((y) => ({
      id: `tw-cdc-amr-${y}`,
      title: {
        'zh-TW': `臺灣抗生素抗藥性監視年報 ${y}`,
        en: `Antimicrobial Resistance Surveillance Annual Report, Taiwan ${y}`,
        ja: `台湾抗菌薬耐性監視年報 ${y}`,
      },
      publisher: '衛生福利部疾病管制署 Taiwan CDC',
      year: y,
      kind: 'annual-report' as const,
    }));
  }, [meta]);

  const dashboard = t('data.cite.dashboardText', { year, url: SITE_URL, date: accessed });
  const cdcLines = reports.map((r) =>
    t('data.cite.cdcText', {
      year: r.year,
      title: localized(r.title, t.locale).replace(/\s*\d{4}$/, ''),
      publisher: t('data.cite.cdcPublisher'),
    }),
  );

  const bibtex = [
    `@misc{twamrwatch${year},`,
    `  title        = {{TW-AMR Watch}: Taiwan antimicrobial resistance surveillance dashboard},`,
    `  author       = {{TW-AMR Watch contributors}},`,
    `  year         = {${year}},`,
    `  howpublished = {\\url{${SITE_URL}}},`,
    `  note         = {Values transcribed from Taiwan CDC annual reports. Source code: ${REPO_URL}. Accessed ${accessed}}`,
    `}`,
    ...reports.flatMap((r) => [
      ``,
      `@techreport{twcdcamr${r.year},`,
      `  title       = {${r.title.en.replace(/\s*\d{4}$/, '')} ${r.year}},`,
      `  author      = {{Taiwan Centers for Disease Control, Ministry of Health and Welfare}},`,
      `  institution = {Taiwan Centers for Disease Control},`,
      `  year        = {${r.year}},`,
      `  type        = {Annual report},`,
      `  note        = {${r.title['zh-TW']}},`,
      `  url         = {${r.url ?? 'https://www.cdc.gov.tw/'}}`,
      `}`,
    ]),
  ].join('\n');

  return (
    <div className={s.stack}>
      <div className={s.twoCol}>
        <div className={s.panel}>
          <h3 className={s.panelTitle}>
            <Icon name="chart" size={18} /> {t('data.cite.dashboard')}
          </h3>
          <p className={s.prose}>{t('data.cite.dashboardBody')}</p>
          <CodeBlock code={dashboard} label={t('data.cite.dashboard')} wrap />
        </div>
        <div className={s.panel}>
          <h3 className={s.panelTitle}>
            <Icon name="table" size={18} /> {t('data.cite.cdc')}
          </h3>
          <p className={s.prose}>{t('data.cite.cdcBody')}</p>
          <CodeBlock code={cdcLines.join('\n\n')} label={t('data.cite.cdc')} wrap />
        </div>
      </div>
      <div className={s.twoCol}>
        <div className={s.panel}>
          <h3 className={s.panelTitle}>
            <Icon name="code" size={18} /> BibTeX
          </h3>
          <CodeBlock code={bibtex} label="BibTeX" />
        </div>
        <div className={s.panel}>
          <h3 className={s.panelTitle}>
            <Icon name="info" size={18} /> {t('data.cite.licence')}
            <Badge tone="warn">{t('data.cite.tbc')}</Badge>
          </h3>
          <ul className={s.bullets}>
            <li>{t('data.cite.licenceData')}</li>
            <li>{t('data.cite.licenceCode')}</li>
            <li>{t('data.cite.licenceProv')}</li>
            <li>{t('data.cite.licenceNotOfficial')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
