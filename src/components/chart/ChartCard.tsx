import { useCallback, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { useDatasetProvisional } from '../../app/providers/DataProvider';
import { useTheme } from '../../app/providers/ThemeProvider';
import { deepLink, parseHashPath, parseHashQuery, SITE_URL, type QueryPatch } from '../../app/url';
import { slugify } from '../../data/format';
import type { DatasetStatus } from '../../data/load';
import type { DatasetName, Precision } from '../../data/types';
import { useT } from '../../i18n';
import { copyText, downloadCsv, downloadDataUrl } from '../../lib/download';
import { DataTable, type Column, type Row } from '../ui/DataTable';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/IconButton';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { FixtureChip, PrecisionBadge, ProvisionalChip } from './badges';
import { ChartToolbar, type ToolbarFeatures } from './ChartToolbar';
import type { EChartHandle } from './EChart';
import { chartDataUrl, composeBrandedPng, nodeDataUrl, type RenderedImage } from './exportImage';
import { useFullscreen } from './useFullscreen';
import s from './chart.module.css';

export interface ChartCardProps {
  /** stable id: DOM anchor, `chart=` deep-link param, default file name */
  id?: string;
  title: string;
  subtitle?: string;
  /** plain-text source line (also printed on PNG exports and share cards) */
  source?: string;
  /** explicit provisional flag; when omitted and `dataset` is given, read from that envelope */
  provisional?: boolean;
  dataset?: Exclude<DatasetName, 'meta'>;
  /** precision badge input: one precision or the records plotted (least exact wins) */
  precision?: Precision | readonly { precision?: Precision }[];
  /** show the "dev fixture" chip */
  isFixture?: boolean;
  /** extra chips next to the title */
  badges?: ReactNode;
  /** dataset status → skeleton / error / empty states instead of children */
  status?: DatasetStatus;
  onRetry?: () => void;
  /** ref to the EChart inside — enables crisp ECharts PNG export (else DOM snapshot) */
  chartRef?: RefObject<EChartHandle>;
  /** rows for the table view + CSV (wide or long) */
  tableRows?: readonly Row[];
  tableColumns?: readonly Column[];
  /** CSV rows if different from tableRows */
  csvRows?: readonly Record<string, unknown>[];
  fileName?: string;
  /** deep link override (absolute). Default: current route + query + chart=id */
  link?: string;
  /** embed registry id + params → "Copy embed code" in Share */
  embed?: { chart: string; params?: QueryPatch };
  /** headline number for the IG share card */
  keyNumber?: { value: string; label?: string };
  eyebrow?: string;
  /** min body height while loading (px) */
  height?: number;
  compact?: boolean;
  toolbar?: boolean | ToolbarFeatures;
  /** extra controls rendered under the header (card-local toggles, legends) */
  actions?: ReactNode;
  /** extra content in the footer (right side) */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Every chart lives in a ChartCard (§5): title, subtitle, source line, provisional /
 * precision chips, and the toolbar (fullscreen, table, PNG, CSV, link, share).
 */
export function ChartCard({
  id,
  title,
  subtitle,
  source,
  provisional,
  dataset,
  precision,
  isFixture,
  badges,
  status = 'ready',
  onRetry,
  chartRef,
  tableRows,
  tableColumns,
  csvRows,
  fileName,
  link,
  embed,
  keyNumber,
  eyebrow,
  height = 340,
  compact,
  toolbar = true,
  actions,
  footer,
  children,
  className,
  style,
}: ChartCardProps) {
  const t = useT();
  const toast = useToast();
  const { theme } = useTheme();
  const autoId = useId();
  const headingId = `${id ?? autoId}-title`;
  const card = useRef<HTMLElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(card);
  const [showTable, setShowTable] = useState(false);
  const [busy, setBusy] = useState(false);
  const envProvisional = useDatasetProvisional(provisional === undefined ? dataset : undefined);
  const isProvisional = provisional ?? envProvisional ?? false;
  const file = fileName ?? slugify(`${id ?? title}`);
  const sourceLine = source ? t('common.sourceLine', { source }) : undefined;

  const getLink = useCallback(() => {
    if (link) return link;
    const q = parseHashQuery();
    if (id) q.set('chart', id);
    return deepLink(parseHashPath(), q);
  }, [link, id]);

  const getChartImage = useCallback(async (): Promise<string | undefined> => {
    const inst = chartRef?.current?.getInstance();
    if (inst && !inst.isDisposed()) return chartDataUrl(inst, theme);
    if (body.current) return nodeDataUrl(body.current, theme);
    return undefined;
  }, [chartRef, theme]);

  const getImage = useCallback(async (): Promise<RenderedImage> => {
    const raw = await getChartImage();
    if (!raw) throw new Error('no image');
    return composeBrandedPng({
      image: raw,
      title,
      subtitle,
      source: sourceLine,
      theme,
      siteName: t('app.name'),
      url: SITE_URL,
      chip: isProvisional ? t('provisional.chip') : undefined,
    });
  }, [getChartImage, title, subtitle, sourceLine, theme, t, isProvisional]);

  const onPng = useCallback(async () => {
    setBusy(true);
    try {
      const img = await getImage();
      downloadDataUrl(img.dataUrl, `${file}.png`);
    } catch {
      toast(t('toolbar.pngFailed'), 'alert');
    } finally {
      setBusy(false);
    }
  }, [getImage, file, toast, t]);

  const rowsForCsv = csvRows ?? tableRows;
  const onCsv = useMemo(
    () => (rowsForCsv && rowsForCsv.length ? () => downloadCsv(rowsForCsv, file) : undefined),
    [rowsForCsv, file],
  );

  const onLink = useCallback(async () => {
    if (await copyText(getLink())) toast(t('toolbar.linkCopied'), 'link');
  }, [getLink, toast, t]);

  const features: ToolbarFeatures = toolbar === true ? {} : toolbar === false ? {} : toolbar;
  const ready = status === 'ready';

  return (
    <>
      {fs.fallback && <div className={s.backdrop} onClick={fs.exit} aria-hidden="true" />}
      <section
        ref={card}
        id={id}
        aria-labelledby={headingId}
        className={[s.card, compact ? s.compact : '', fs.fallback ? s.pseudoFull : '', className].filter(Boolean).join(' ')}
        style={style}
        onKeyDown={(e) => fs.fallback && e.key === 'Escape' && fs.exit()}
      >
        <header className={s.head}>
          <div className={s.titles}>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <div className={s.titleRow}>
              <h3 id={headingId} className={s.title}>
                {title}
              </h3>
              {isProvisional && <ProvisionalChip />}
              {precision && <PrecisionBadge precision={precision} />}
              {isFixture && <FixtureChip />}
              {badges}
            </div>
            {subtitle && <p className={s.subtitle}>{subtitle}</p>}
          </div>
          {toolbar !== false && ready && (
            <div className={s.headRight}>
              <ChartToolbar
                title={title}
                subtitle={subtitle}
                fileName={file}
                features={features}
                busy={busy}
                fullscreen={{ active: fs.active, toggle: fs.toggle }}
                table={tableRows ? { shown: showTable, toggle: () => setShowTable((v) => !v) } : undefined}
                onDownloadPng={onPng}
                onDownloadCsv={onCsv}
                onCopyLink={onLink}
                share={{
                  url: getLink(),
                  getImage,
                  getChartImage,
                  embed,
                  provisional: isProvisional,
                  card: { eyebrow, keyValue: keyNumber?.value, keyLabel: keyNumber?.label, source: sourceLine },
                }}
              />
            </div>
          )}
        </header>
        {actions && <div className={s.actions}>{actions}</div>}
        <div className={s.body} ref={body} style={{ '--body-min-h': ready ? undefined : `${height}px` } as CSSProperties}>
          {status === 'loading' ? (
            <ChartSkeleton height={height} label={t('common.loading')} />
          ) : status === 'error' ? (
            <div className={s.state}>
              <EmptyState
                icon="alert"
                title={t('common.error')}
                body={t('common.errorBody')}
                action={onRetry ? <Button onClick={onRetry}>{t('actions.retry')}</Button> : undefined}
              />
            </div>
          ) : status === 'empty' ? (
            <div className={s.state}>
              <EmptyState title={t('common.empty')} body={t('common.emptyBody')} />
            </div>
          ) : (
            <>
              <div className={[s.chartLayer, showTable ? s.chartHidden : ''].join(' ')} aria-hidden={showTable || undefined}>
                {children}
              </div>
              {showTable && tableRows && (
                <div className={s.tableLayer}>
                  <DataTable rows={tableRows} columns={tableColumns} caption={title} csvName={false} />
                </div>
              )}
            </>
          )}
        </div>
        {(sourceLine || footer) && (
          <footer className={s.foot}>
            <span className={s.source}>{sourceLine}</span>
            {footer}
          </footer>
        )}
      </section>
    </>
  );
}

export function ChartSkeleton({ height = 300, label }: { height?: number; label?: string }) {
  const bars = [42, 58, 50, 72, 64, 80, 70, 88, 76, 92];
  return (
    <div className={s.skeletonChart} style={{ height }} aria-busy="true" aria-label={label} role="status">
      <Skeleton width="38%" height={10} />
      <div className={s.skeletonBars} style={{ flex: 1 }}>
        {bars.map((h, i) => (
          <Skeleton key={i} height={`${h}%`} radius={6} style={{ flex: 1 }} />
        ))}
      </div>
      <Skeleton height={8} />
    </div>
  );
}
