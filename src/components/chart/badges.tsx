import { precisionBadge } from '../../data/select';
import type { Precision } from '../../data/types';
import { useT } from '../../i18n';
import { Badge } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';

/** "Provisional" chip — shown on cards whose dataset envelope has provisional: true. */
export function ProvisionalChip() {
  const t = useT();
  return (
    <Tooltip content={t('provisional.chipHint')}>
      <span tabIndex={0} style={{ display: 'inline-flex', borderRadius: 999 }}>
        <Badge tone="warn" dot>
          {t('provisional.chip')}
        </Badge>
      </span>
    </Tooltip>
  );
}

/** Precision badge for transcribed values (table / text / chart_estimate). Hidden for 'table'. */
export function PrecisionBadge({
  precision,
  showExact = false,
}: {
  precision: Precision | readonly { precision?: Precision }[] | undefined;
  /** also render a badge when everything is exact ('table') */
  showExact?: boolean;
}) {
  const t = useT();
  const b = precisionBadge(precision);
  if (!b || (b.precision === 'table' && !showExact)) return null;
  return (
    <Tooltip content={t(b.hintKey)}>
      <span tabIndex={0} style={{ display: 'inline-flex', borderRadius: 999 }}>
        <Badge tone={b.tone}>{t(b.labelKey)}</Badge>
      </span>
    </Tooltip>
  );
}

/** Dev fixture chip — data came from src/data/fixtures, not public/data. */
export function FixtureChip() {
  const t = useT();
  return (
    <Tooltip content={t('fixture.hint')}>
      <span tabIndex={0} style={{ display: 'inline-flex', borderRadius: 999 }}>
        <Badge tone="info">{t('fixture.chip')}</Badge>
      </span>
    </Tooltip>
  );
}
