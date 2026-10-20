import { PlaceholderPage } from '../../components/layout/PlaceholderPage';
import { Section } from '../../components/layout/PageHeader';
import { KpiStrip } from '../../embed/charts/KpiStrip';
import { ResistanceHeatmap } from '../../embed/charts/ResistanceHeatmap';
import { ResistanceTrend } from '../../embed/charts/ResistanceTrend';
import { useHashQuery } from '../../app/hooks/useHashQuery';
import { parseChartParams } from '../../embed/charts/common';
import s from './overview.module.css';

/**
 * Route "/" — PLACEHOLDER that demonstrates the shared chart infrastructure with the
 * three shipped charts (KPI strip, resistance trend, heatmap). The overview agent
 * replaces this module.
 */
export default function OverviewPage() {
  const q = useHashQuery();
  const p = parseChartParams(q.params);
  return (
    <PlaceholderPage pageKey="overview" hero>
      <KpiStrip level={p.level} />
      <Section>
        <div className={s.grid}>
          <ResistanceTrend pathogen={p.pathogen ?? 'ABA'} antibiotic={p.antibiotic ?? 'MEM'} level={p.level} years={p.years} />
          <ResistanceTrend pathogen="KPN" antibiotic="MEM" level={p.level} years={p.years} />
        </div>
      </Section>
      <Section>
        <ResistanceHeatmap level={p.level} />
      </Section>
    </PlaceholderPage>
  );
}
