/** Suggested questions grouped by topic (i18n keys under chat.q.* / chat.topics.*). */
export const SUGGESTION_GROUPS: { topic: string; keys: string[] }[] = [
  { topic: 'data', keys: ['crkpMc', 'mrsaHo', 'ecoCip', 'crabLevel', 'vreYears', 'crkpSetting'] },
  { topic: 'compare', keys: ['crabJapan', 'mrsaWorld', 'twnKor'] },
  { topic: 'counts', keys: ['isoTotal', 'isoTop', 'ecoBlood'] },
  { topic: 'concepts', keys: ['whatCrab', 'carbapenemase', 'aware', 'contact'] },
  { topic: 'site', keys: ['download', 'api', 'embed', 'provisional'] },
];

/** Shown in the empty-state welcome message. */
export const WELCOME_KEYS = ['crkpMc', 'crabLevel', 'crabJapan', 'whatCrab'];
