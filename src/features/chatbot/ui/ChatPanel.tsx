/**
 * The assistant body used by both the floating drawer and the #/chat page:
 * toolbar (mode badge, settings, clear), message list, follow-up chips, composer.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Icon } from '../../../components/ui/icons';
import { useToast } from '../../../components/ui/Toast';
import { useT } from '../../../i18n';
import { CLAUDE_MODEL } from '../engine/claude';
import { WELCOME_KEYS } from '../suggestions';
import { ChatIcon } from './icons';
import { MessageView } from './MessageView';
import { SettingsPanel } from './SettingsPanel';
import { useChat } from './useChat';
import s from './chat.module.css';

export interface ChatRequest {
  q: string;
  nonce: number;
}

export interface ChatPanelProps {
  variant?: 'drawer' | 'page';
  /** question to send (e.g. from openChat({ q }) or the page sidebar); re-sent when nonce changes */
  request?: ChatRequest | null;
  /** called when an in-app link inside an answer is followed (the drawer closes itself) */
  onNavigate?: () => void;
  /** extra toolbar content (e.g. "open full page" in the drawer) */
  toolbarExtra?: ReactNode;
}

export function ChatPanel({ variant = 'drawer', request, onNavigate, toolbarExtra }: ChatPanelProps) {
  const t = useT();
  const toast = useToast();
  const { messages, send, stop, clear, busy, apiKey } = useChat();
  const [draft, setDraft] = useState('');
  const [settings, setSettings] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const handled = useRef<number | null>(null);
  const hintId = useId();

  useEffect(() => {
    if (!request || handled.current === request.nonce) return;
    handled.current = request.nonce;
    void send(request.q);
  }, [request, send]);

  const last = messages[messages.length - 1];
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, last?.text, last?.pending]);

  useEffect(() => {
    if (variant === 'drawer') inputRef.current?.focus();
  }, [variant]);

  const submit = () => {
    const q = draft.trim();
    if (!q || busy) return;
    setDraft('');
    void send(q);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };
  const onChip = (q: string) => {
    void send(q);
    inputRef.current?.focus();
  };
  const onLink = (_e: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#/')) onNavigate?.();
  };

  const claude = !!apiKey;

  return (
    <div className={`${s.panel} ${variant === 'page' ? s.panelPage : s.panelDrawer}`}>
      <div className={s.toolbar}>
        <button
          type="button"
          className={claude ? s.modeOn : s.modeOff}
          onClick={() => setSettings((v) => !v)}
          title={claude ? t('chat.ui.claudeHint', { model: CLAUDE_MODEL }) : t('chat.ui.offlineHint')}
          aria-expanded={settings}
        >
          <ChatIcon name={claude ? 'sparkle' : 'offline'} size={14} />
          <span>{claude ? t('chat.ui.claude') : t('chat.ui.offline')}</span>
          {!claude && <span className={s.upgrade}>{t('chat.ui.upgrade')}</span>}
        </button>
        <span className={s.spacer} />
        {toolbarExtra}
        <button type="button" className={s.tool} onClick={() => setSettings((v) => !v)} aria-label={t('chat.ui.settings')} title={t('chat.ui.settings')} aria-pressed={settings}>
          <ChatIcon name="gear" size={17} />
        </button>
        <button
          type="button"
          className={s.tool}
          onClick={() => {
            clear();
            toast(t('chat.ui.clearDone'));
            inputRef.current?.focus();
          }}
          disabled={!messages.length}
          aria-label={t('chat.ui.clear')}
          title={t('chat.ui.clear')}
        >
          <ChatIcon name="trash" size={17} />
        </button>
      </div>

      {settings && <SettingsPanel onClose={() => setSettings(false)} />}

      <div ref={listRef} className={s.scroll} role="log" aria-live="polite" aria-relevant="additions text" aria-label={t('chat.ui.messages')} tabIndex={0}>
        {!messages.length ? (
          <div className={s.welcome}>
            <span className={s.welcomeIcon} aria-hidden="true">
              <ChatIcon name="bot" size={22} />
            </span>
            <h3 className={s.welcomeTitle}>{t('chat.ui.welcomeTitle')}</h3>
            <p className={s.welcomeBody}>{t('chat.ui.welcomeBody')}</p>
            <div className={s.chips}>
              {WELCOME_KEYS.map((k) => (
                <button key={k} type="button" className={s.chip} onClick={() => onChip(t(`chat.q.${k}`))}>
                  {t(`chat.q.${k}`)}
                </button>
              ))}
            </div>
            {!claude && <p className={s.offlineNote}>{t('chat.ui.offlineHint')}</p>}
          </div>
        ) : (
          <ol className={s.list}>
            {messages.map((m, i) => (
              <MessageView key={m.id} msg={m} last={i === messages.length - 1} busy={busy} onChip={onChip} onLink={onLink} />
            ))}
          </ol>
        )}
      </div>

      <form
        className={s.composer}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={inputRef}
          className={s.input}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          placeholder={t('chat.placeholder')}
          aria-label={t('chat.placeholder')}
          aria-describedby={hintId}
          maxLength={600}
          data-autofocus={variant === 'drawer' ? true : undefined}
        />
        {busy && claude ? (
          <button type="button" className={s.send} onClick={stop} aria-label={t('chat.ui.stop')} title={t('chat.ui.stop')}>
            <ChatIcon name="stop" size={16} />
          </button>
        ) : (
          <button type="submit" className={s.send} aria-label={t('chat.send')} title={t('chat.send')} disabled={!draft.trim() || busy}>
            <Icon name="send" size={16} />
          </button>
        )}
      </form>
      <p id={hintId} className={s.hint}>
        {t('chat.ui.composerHint')}
      </p>
    </div>
  );
}

export default ChatPanel;
