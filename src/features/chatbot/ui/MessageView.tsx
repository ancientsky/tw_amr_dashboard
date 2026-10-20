/** One chat message: markdown-lite body, mini chart, deep links, follow-up chips, copy/share. */
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { facebookIntent, lineIntent, openShareWindow, threadsIntent, xIntent } from '../../../components/share/intents';
import { Icon } from '../../../components/ui/icons';
import { useToast } from '../../../components/ui/Toast';
import { siteBase } from '../../../app/url';
import { useT } from '../../../i18n';
import { ChatIcon } from './icons';
import { Markdown, toPlain } from './Markdown';
import { MiniChart } from './MiniChart';
import type { ChatMessage } from './storage';
import s from './chat.module.css';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** Absolute URL for an in-app hash link (falls back to the chat page). */
export function absoluteLink(href: string | undefined): string {
  return `${siteBase()}${href && href.startsWith('#/') ? href : '#/chat'}`;
}

/** Deep link that re-asks the question on #/chat (recipients get the same answer + chart in their language). */
export function questionLink(question: string | undefined, fallbackHref?: string): string {
  if (!question) return absoluteLink(fallbackHref);
  return `${siteBase()}#/chat?q=${encodeURIComponent(question.slice(0, 200))}`;
}

function ShareMenu({ msg, question, onClose }: { msg: ChatMessage; question?: string; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const url = questionLink(question, msg.links?.[0]?.href);
  const plain = toPlain(msg.text).replace(/\s+/g, ' ');
  const text = t('chat.ui.shareText', { text: plain.length > 180 ? `${plain.slice(0, 177)}…` : plain });
  const target = { url, text, hashtags: ['AMR', 'TWAMRWatch'] };
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const onDoc = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);
  const items = [
    { key: 'x', icon: 'x-twitter' as const, label: t('chat.ui.shareX'), go: () => openShareWindow(xIntent(target)) },
    { key: 'th', icon: 'threads' as const, label: t('chat.ui.shareThreads'), go: () => openShareWindow(threadsIntent(target)) },
    { key: 'fb', icon: 'facebook' as const, label: t('chat.ui.shareFacebook'), go: () => openShareWindow(facebookIntent(target)) },
    { key: 'line', icon: 'line' as const, label: t('chat.ui.shareLine'), go: () => openShareWindow(lineIntent(target)) },
    {
      key: 'link',
      icon: 'link' as const,
      label: t('chat.ui.copyLink'),
      go: async () => {
        if (await copyText(url)) toast(t('chat.ui.linkCopied'));
      },
    },
  ];
  return (
    <div ref={ref} className={s.shareMenu} role="menu" aria-label={t('chat.ui.share')}>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="menuitem"
          className={s.shareItem}
          onClick={() => {
            void it.go();
            onClose();
          }}
        >
          <Icon name={it.icon} size={16} />
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

export interface MessageViewProps {
  msg: ChatMessage;
  /** the user question this answer replies to (for share deep links) */
  question?: string;
  last: boolean;
  busy: boolean;
  onChip: (q: string) => void;
  onLink?: (e: MouseEvent<HTMLAnchorElement>, href: string) => void;
}

export function MessageView({ msg, question, last, busy, onChip, onLink }: MessageViewProps) {
  const t = useT();
  const toast = useToast();
  const [sharing, setSharing] = useState(false);
  if (msg.role === 'user') {
    return (
      <li className={`${s.row} ${s.rowUser}`}>
        <span className="sr-only">{t('chat.ui.you')}: </span>
        <div className={s.userBubble}>{msg.text}</div>
      </li>
    );
  }
  const copy = async () => {
    const link = msg.links?.[0] ? `\n${absoluteLink(msg.links[0].href)}` : '';
    if (await copyText(`${toPlain(msg.text)}${link}`)) toast(t('chat.ui.copied'));
  };
  return (
    <li className={`${s.row} ${s.rowBot}`}>
      <span className={s.avatar} aria-hidden="true">
        <ChatIcon name={msg.source === 'claude' ? 'sparkle' : 'bot'} size={16} />
      </span>
      <div className={s.botCol}>
        <div className={s.botBubble} aria-busy={msg.pending || undefined}>
          <span className="sr-only">{t('chat.ui.assistant')}: </span>
          {msg.error && (
            <p className={s.errorNote} role="status">
              <Icon name="alert" size={14} />
              <span>{msg.error}</span>
            </p>
          )}
          {msg.pending && !msg.text ? (
            <span className={s.typing} aria-label={t('chat.ui.thinking')}>
              <i />
              <i />
              <i />
            </span>
          ) : (
            <Markdown text={msg.text} onLink={onLink} />
          )}
          {msg.chart && !msg.pending && <MiniChart spec={msg.chart} />}
          {!!msg.links?.length && !msg.pending && (
            <div className={s.links}>
              {msg.links.map((l) => (
                <a key={l.href} href={l.href} className={s.deepLink} onClick={(e) => onLink?.(e, l.href)}>
                  <Icon name="chart" size={15} />
                  <span>{l.label}</span>
                  <Icon name="chevron-right" size={14} />
                </a>
              ))}
            </div>
          )}
          {!msg.pending && (
            <div className={s.meta}>
              <span className={s.via}>{msg.source === 'claude' ? t('chat.ui.viaClaude') : t('chat.ui.viaOffline')}</span>
              <span className={s.actions} role="group" aria-label={t('chat.ui.moreActions')}>
                <button type="button" className={s.act} onClick={copy} title={t('chat.ui.copy')} aria-label={t('chat.ui.copy')}>
                  <Icon name="copy" size={15} />
                </button>
                <span className={s.shareWrap}>
                  <button
                    type="button"
                    className={s.act}
                    onClick={() => setSharing((v) => !v)}
                    title={t('chat.ui.share')}
                    aria-label={t('chat.ui.share')}
                    aria-haspopup="menu"
                    aria-expanded={sharing}
                  >
                    <Icon name="share" size={15} />
                  </button>
                  {sharing && <ShareMenu msg={msg} question={question} onClose={() => setSharing(false)} />}
                </span>
              </span>
            </div>
          )}
        </div>
        {last && !busy && !!msg.chips?.length && (
          <div className={s.chips} role="group" aria-label={t('chat.ui.followUps')}>
            {msg.chips.map((c) => (
              <button key={c} type="button" className={s.chip} onClick={() => onChip(c)}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
