/** Claude-mode settings: paste / forget the user's own Anthropic API key (localStorage only). */
import { useId, useState } from 'react';
import { useToast } from '../../../components/ui/Toast';
import { useT } from '../../../i18n';
import { CLAUDE_MODEL, KEY_STORAGE, looksLikeKey, readKey, writeKey } from '../engine/claude';
import { ChatIcon } from './icons';
import s from './chat.module.css';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const id = useId();
  const [stored, setStored] = useState(() => readKey());
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const invalid = value.trim().length > 0 && !looksLikeKey(value);

  const save = () => {
    const k = value.trim();
    if (!k) return;
    writeKey(k);
    setStored(readKey() || k);
    setValue('');
    toast(t('chat.settings.saved'));
  };
  const forget = () => {
    writeKey(null);
    setStored('');
    toast(t('chat.settings.forgotten'));
  };

  return (
    <section className={s.settings} aria-labelledby={`${id}-h`}>
      <div className={s.settingsHead}>
        <h3 id={`${id}-h`} className={s.settingsTitle}>
          <ChatIcon name="key" size={16} />
          {t('chat.settings.title')}
        </h3>
        <span className={stored ? s.statusOn : s.statusOff}>{stored ? t('chat.settings.active') : t('chat.settings.inactive')}</span>
      </div>
      <p className={s.settingsText}>{t('chat.settings.intro', { model: CLAUDE_MODEL })}</p>
      <form
        className={s.keyRow}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label htmlFor={`${id}-k`} className="sr-only">
          {t('chat.settings.keyLabel')}
        </label>
        <input
          id={`${id}-k`}
          className={s.keyInput}
          type={show ? 'text' : 'password'}
          autoComplete="off"
          spellCheck={false}
          placeholder={stored ? `${stored.slice(0, 10)}…${stored.slice(-4)}` : t('chat.settings.keyPlaceholder')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-p`}
          data-autofocus
        />
        <button type="button" className={s.ghostBtn} onClick={() => setShow((v) => !v)} aria-pressed={show}>
          {show ? t('chat.settings.hide') : t('chat.settings.show')}
        </button>
        <button type="submit" className={s.primaryBtn} disabled={!value.trim()}>
          {t('chat.settings.save')}
        </button>
      </form>
      {invalid && (
        <p className={s.warn} role="alert">
          {t('chat.settings.invalid')}
        </p>
      )}
      <p id={`${id}-p`} className={s.privacy}>
        {t('chat.settings.privacy').replace('twamr.anthropicKey', KEY_STORAGE)}
      </p>
      <div className={s.settingsActions}>
        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className={s.mdLink}>
          {t('chat.settings.getKey')}
        </a>
        <span className={s.spacer} />
        {stored && (
          <button type="button" className={s.dangerBtn} onClick={forget}>
            {t('chat.settings.forget')}
          </button>
        )}
        <button type="button" className={s.ghostBtn} onClick={onClose}>
          {t('chat.settings.close')}
        </button>
      </div>
    </section>
  );
}
