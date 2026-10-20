import type { DatasetName } from '../data/types';

/**
 * Route metadata (labels, datasets) shared by TopNav, SideNav, Footer and the
 * per-route ProvisionalBanner. Components live in routes.tsx. Append only.
 */
export interface NavItem {
  path: string;
  /** i18n suffix: nav.<key>, pages.<key>.title|subtitle|eyebrow */
  key: 'overview' | 'resistance' | 'antibioticUse' | 'hai' | 'international' | 'data' | 'resources' | 'about' | 'chat';
  /** datasets whose envelope `provisional` flag drives this page's notice */
  datasets: Exclude<DatasetName, 'meta'>[];
  /** banner variant: 'site' summarises mixed provenance (overview) */
  banner?: 'section' | 'site';
}

export const NAV: readonly NavItem[] = [
  { path: '/', key: 'overview', datasets: ['antibiotic_use', 'hai', 'glass'], banner: 'site' },
  { path: '/resistance', key: 'resistance', datasets: ['resistance', 'isolates'] },
  { path: '/antibiotic-use', key: 'antibioticUse', datasets: ['antibiotic_use'] },
  { path: '/hai', key: 'hai', datasets: ['hai', 'hai_pathogens'] },
  { path: '/international', key: 'international', datasets: ['glass'] },
  { path: '/data', key: 'data', datasets: [] },
  { path: '/resources', key: 'resources', datasets: [] },
  { path: '/about', key: 'about', datasets: [] },
  { path: '/chat', key: 'chat', datasets: [] },
];

export function navFor(pathname: string): NavItem | undefined {
  return NAV.find((n) => n.path === pathname);
}
