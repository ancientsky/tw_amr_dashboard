import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { embedSnippet, type QueryPatch } from '../../app/url';
import { useT } from '../../i18n';
import { copyImage, copyText, downloadBlob } from '../../lib/download';
import type { RenderedImage } from '../chart/exportImage';
import { IconButton } from '../ui/IconButton';
import { Icon, type IconName } from '../ui/icons';
import { useToast } from '../ui/Toast';
import { usePopover } from '../ui/usePopover';
import { facebookIntent, lineIntent, openShareWindow, threadsIntent, xIntent } from './intents';
import { ShareCardRenderer } from './ShareCardRenderer';
import s from './share.module.css';

export interface ShareMenuProps {
  /** localized chart title */
  title: string;
  subtitle?: string;
  /** absolute deep link to this chart/view */
  url: string;
  /** branded PNG (title + chart + source + watermark) */
  getImage?: () => Promise<RenderedImage>;
  /** raw chart image for the IG card */
  getChartImage?: () => Promise<string | undefined>;
  /** embed registry id + params → "Copy embed code" */
  embed?: { chart: string; params?: QueryPatch };
  /** IG card content */
  card?: { eyebrow?: string; keyValue?: string; keyLabel?: string; source?: string };
  provisional?: boolean;
  fileName: string;
  align?: 'start' | 'end';
  size?: 'sm' | 'md';
}

/**
 * Share popover: X / Threads / Facebook / LINE intents, Web Share (with image file when
 * supported), copy image, Instagram card renderer, copy embed code.
 */
export function ShareMenu({ title, subtitle, url, getImage, getChartImage, embed, card, provisional, fileName, align = 'end', size = 'sm' }: ShareMenuProps) {
  const t = useT();
  const toast = useToast();
  const { open, setOpen, ref } = usePopover<HTMLDivElement>();
  const [cardOpen, setCardOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const text = t('share.text', { title, site: t('app.name') });
  const hashtags = t('share.hashtags')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const target = { url, text, hashtags };

  const canWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const webShare = useCallback(async () => {
    setOpen(false);
    try {
      if (getImage && navigator.canShare) {
        const img = await getImage();
        const file = new File([img.blob], `${fileName}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title, text, url, files: [file] });
          return;
        }
      }
      await navigator.share({ title, text, url });
    } catch {
      /* user cancelled */
    }
  }, [getImage, fileName, title, text, url, setOpen]);

  const doCopyImage = useCallback(async () => {
    setOpen(false);
    if (!getImage) return;
    const p = getImage();
    const ok = await copyImage(p.then((r) => r.blob));
    if (ok) toast(t('share.imageCopied'));
    else {
      const r = await p;
      downloadBlob(r.blob, `${fileName}.png`);
      toast(t('share.copyImageUnsupported'), 'download');
    }
  }, [getImage, fileName, toast, t, setOpen]);

  const doEmbed = useCallback(async () => {
    setOpen(false);
    if (!embed) return;
    const ok = await copyText(embedSnippet(embed.chart, { lang: t.locale, ...embed.params }));
    if (ok) toast(t('share.embedCopied'));
  }, [embed, toast, t, setOpen]);

  const onMenuKey = (e: KeyboardEvent) => {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') items[(i + 1) % items.length]?.focus();
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') items[(i - 1 + items.length) % items.length]?.focus();
    else if (e.key === 'Home') items[0]?.focus();
    else if (e.key === 'End') items[items.length - 1]?.focus();
    else return;
    e.preventDefault();
  };

  const socials: { key: string; icon: IconName; label: string; href: string }[] = [
    { key: 'x', icon: 'x-twitter', label: 'X', href: xIntent(target) },
    { key: 'threads', icon: 'threads', label: t('share.threads'), href: threadsIntent(target) },
    { key: 'fb', icon: 'facebook', label: t('share.facebook'), href: facebookIntent(target) },
    { key: 'line', icon: 'line', label: t('share.line'), href: lineIntent(target) },
  ];

  const Item = ({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) => (
    <button type="button" role="menuitem" className={s.item} onClick={onClick}>
      <span className={s.itemIcon}>
        <Icon name={icon} size={16} />
      </span>
      {label}
    </button>
  );

  return (
    <div className={s.wrap} ref={ref}>
      <IconButton
        icon="share"
        label={t('toolbar.share')}
        size={size}
        aria-haspopup="menu"
        aria-expanded={open}
        active={open}
        onClick={() => {
          setOpen(!open);
          if (!open) requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
        }}
      />
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menu}
            role="menu"
            aria-label={t('share.title')}
            className={[s.menu, align === 'start' ? s.alignStart : ''].join(' ')}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            onKeyDown={onMenuKey}
          >
            <div className={s.group}>{t('share.social')}</div>
            <div className={s.socialRow}>
              {socials.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  role="menuitem"
                  className={s.social}
                  title={x.label}
                  onClick={() => {
                    setOpen(false);
                    openShareWindow(x.href);
                  }}
                >
                  <span className={s.socialIcon}>
                    <Icon name={x.icon} size={18} />
                  </span>
                  {x.label}
                </button>
              ))}
            </div>
            <div className={s.sep} />
            {canWebShare && <Item icon="share" label={t('share.webShare')} onClick={webShare} />}
            {getImage && <Item icon="image" label={t('share.copyImage')} onClick={doCopyImage} />}
            <Item
              icon="instagram"
              label={t('share.instagram')}
              onClick={() => {
                setOpen(false);
                setCardOpen(true);
              }}
            />
            {embed && <Item icon="code" label={t('share.embed')} onClick={doEmbed} />}
          </motion.div>
        )}
      </AnimatePresence>
      <ShareCardRenderer
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        title={title}
        subtitle={subtitle}
        eyebrow={card?.eyebrow}
        keyValue={card?.keyValue}
        keyLabel={card?.keyLabel}
        source={card?.source}
        url={url}
        provisional={provisional}
        getChartImage={getChartImage}
        fileName={fileName}
      />
    </div>
  );
}
