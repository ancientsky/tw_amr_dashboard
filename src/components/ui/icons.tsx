import type { SVGProps } from 'react';

/** Inline SVG icon set (24×24 grid, 1.75 stroke, currentColor). */
export type IconName =
  | 'download'
  | 'share'
  | 'table'
  | 'chart'
  | 'fullscreen'
  | 'fullscreen-exit'
  | 'link'
  | 'copy'
  | 'sun'
  | 'moon'
  | 'globe'
  | 'chat'
  | 'close'
  | 'chevron-down'
  | 'chevron-right'
  | 'chevron-left'
  | 'external'
  | 'x-twitter'
  | 'facebook'
  | 'threads'
  | 'line'
  | 'instagram'
  | 'check'
  | 'menu'
  | 'image'
  | 'code'
  | 'info'
  | 'alert'
  | 'arrow-up'
  | 'arrow-down'
  | 'sort'
  | 'search'
  | 'send'
  | 'file-csv';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const PATHS: Record<IconName, JSX.Element> = {
  download: (
    <g {...stroke}>
      <path d="M12 4v11" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 19h14" />
    </g>
  ),
  share: (
    <g {...stroke}>
      <path d="M12 3v12" />
      <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
      <path d="M8 11H6a1 1 0 0 0-1 1v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a1 1 0 0 0-1-1h-2" />
    </g>
  ),
  table: (
    <g {...stroke}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" />
    </g>
  ),
  chart: (
    <g {...stroke}>
      <path d="M4 20h16" />
      <path d="M7 16v-4M12 16V7M17 16v-6" />
    </g>
  ),
  fullscreen: (
    <g {...stroke}>
      <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
    </g>
  ),
  'fullscreen-exit': (
    <g {...stroke}>
      <path d="M9 4v4a1 1 0 0 1-1 1H4M20 9h-4a1 1 0 0 1-1-1V4M15 20v-4a1 1 0 0 1 1-1h4M4 15h4a1 1 0 0 1 1 1v4" />
    </g>
  ),
  link: (
    <g {...stroke}>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </g>
  ),
  copy: (
    <g {...stroke}>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2" />
      <path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
    </g>
  ),
  sun: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </g>
  ),
  moon: (
    <g {...stroke}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </g>
  ),
  globe: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.2 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.2-3.6-8.5S9.6 5.8 12 3.5Z" />
    </g>
  ),
  chat: (
    <g {...stroke}>
      <path d="M20 11.5a7.5 7.5 0 0 1-11 6.6L4 19.5l1.4-4.4A7.5 7.5 0 1 1 20 11.5Z" />
      <path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" strokeWidth={2.4} />
    </g>
  ),
  close: (
    <g {...stroke}>
      <path d="M6 6l12 12M18 6 6 18" />
    </g>
  ),
  'chevron-down': (
    <g {...stroke}>
      <path d="m6 9 6 6 6-6" />
    </g>
  ),
  'chevron-right': (
    <g {...stroke}>
      <path d="m9 6 6 6-6 6" />
    </g>
  ),
  'chevron-left': (
    <g {...stroke}>
      <path d="m15 6-6 6 6 6" />
    </g>
  ),
  external: (
    <g {...stroke}>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </g>
  ),
  'x-twitter': (
    <path
      fill="currentColor"
      d="M17.53 3h3.07l-6.7 7.66L21.8 21h-6.17l-4.83-6.32L5.27 21H2.2l7.17-8.2L1.8 3h6.33l4.37 5.77L17.53 3Zm-1.08 16.17h1.7L7.17 4.74H5.35l11.1 14.43Z"
    />
  ),
  facebook: (
    <path
      fill="currentColor"
      d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.87.25-1.46 1.5-1.46h1.55V4.47A20.6 20.6 0 0 0 14.3 4.3c-2.24 0-3.8 1.37-3.8 3.9v2.3H8v3h2.5V21h3Z"
    />
  ),
  threads: (
    <path
      fill="currentColor"
      d="M16.9 11.2c-.1 0-.2-.1-.3-.1-.2-3-1.8-4.7-4.6-4.7-1.7 0-3.1.7-3.9 2l1.5 1c.6-.9 1.6-1.1 2.4-1.1 1 0 1.7.3 2.2.9.3.4.6 1 .7 1.7a12 12 0 0 0-2.8-.1c-2.8.2-4.6 1.8-4.5 4.1.1 1.2.7 2.2 1.7 2.8.8.6 1.9.8 3 .8 1.5-.1 2.6-.6 3.4-1.6.6-.8 1-1.8 1.2-3 .7.4 1.2 1 1.5 1.7.5 1.1.5 3-1 4.5-1.3 1.3-2.9 1.9-5.3 1.9-2.6 0-4.6-.9-5.9-2.5C5 17.8 4.4 15.6 4.4 13s.6-4.8 1.8-6.3C7.5 5 9.5 4.2 12.1 4.2s4.6.9 5.9 2.5c.7.8 1.1 1.8 1.5 3l1.8-.5c-.4-1.4-1-2.7-1.9-3.7C17.7 3.4 15.2 2.3 12.1 2.3 8.9 2.3 6.5 3.4 4.9 5.4 3.4 7.2 2.6 9.8 2.6 13s.8 5.8 2.3 7.6c1.6 2 4 3.1 7.2 3.1 2.8 0 4.8-.7 6.5-2.4 2.2-2.2 2.1-4.9 1.4-6.6-.5-1.2-1.6-2.3-3.1-3Zm-4.8 4.6c-1.2.1-2.4-.5-2.4-1.5-.1-.8.5-1.6 2.2-1.7h.7c.6 0 1.2.1 1.7.2-.2 2.5-1.3 3-2.2 3Z"
    />
  ),
  line: (
    <path
      fill="currentColor"
      d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.6 7.4 8.4 8 .3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.6 1.1-.5 5.9-3.5 8-6 1.5-1.6 2-3.2 2-5C22 6.6 17.5 3 12 3ZM8.3 13.4H6.3c-.3 0-.5-.2-.5-.5V9c0-.3.2-.5.5-.5s.5.2.5.5v3.4h1.5c.3 0 .5.2.5.5s-.2.5-.5.5Zm2 -.5c0 .3-.2.5-.5.5s-.5-.2-.5-.5V9c0-.3.2-.5.5-.5s.5.2.5.5v3.9Zm4.8 0c0 .2-.1.4-.3.5h-.2c-.2 0-.3-.1-.4-.2l-2-2.7v2.4c0 .3-.2.5-.5.5s-.5-.2-.5-.5V9c0-.2.1-.4.3-.5h.2c.2 0 .3.1.4.2l2 2.7V9c0-.3.2-.5.5-.5s.5.2.5.5v3.9Zm3.2-2.4c.3 0 .5.2.5.5s-.2.5-.5.5h-1.5v.9h1.5c.3 0 .5.2.5.5s-.2.5-.5.5h-2c-.3 0-.5-.2-.5-.5V9c0-.3.2-.5.5-.5h2c.3 0 .5.2.5.5s-.2.5-.5.5h-1.5v.9h1.5Z"
    />
  ),
  instagram: (
    <g {...stroke}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.2 6.8h.01" strokeWidth={2.6} />
    </g>
  ),
  check: (
    <g {...stroke} strokeWidth={2.2}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </g>
  ),
  menu: (
    <g {...stroke}>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </g>
  ),
  image: (
    <g {...stroke}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m20.5 16-5-5-9 8.5" />
    </g>
  ),
  code: (
    <g {...stroke}>
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14" />
    </g>
  ),
  info: (
    <g {...stroke}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" strokeWidth={2} />
    </g>
  ),
  alert: (
    <g {...stroke}>
      <path d="M10.3 4.2 2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 17h.01" strokeWidth={2} />
    </g>
  ),
  'arrow-up': (
    <g {...stroke} strokeWidth={2}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </g>
  ),
  'arrow-down': (
    <g {...stroke} strokeWidth={2}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </g>
  ),
  sort: (
    <g {...stroke}>
      <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />
    </g>
  ),
  search: (
    <g {...stroke}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </g>
  ),
  'file-csv': (
    <g {...stroke}>
      <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5l-5-5Z" />
      <path d="M14 3.5v5h5" />
      <path d="M8.5 12.5h7M8.5 16h7M12 12.5V19" />
    </g>
  ),
  send: (
    <g {...stroke}>
      <path d="M4 12 20 4l-6 16-3-7-7-1Z" />
    </g>
  ),
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** accessible label; when omitted the icon is aria-hidden (decorative) */
  title?: string;
}

export function Icon({ name, size = 18, title, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
