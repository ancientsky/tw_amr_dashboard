import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { NAV, type NavItem } from './nav';

/**
 * Route → lazily-loaded feature page (one component per feature dir, §3).
 * Shared file — append only. Each feature agent replaces its own page module.
 */
export interface AppRoute extends NavItem {
  Component: LazyExoticComponent<ComponentType>;
}

const pages: Record<NavItem['key'], LazyExoticComponent<ComponentType>> = {
  overview: lazy(() => import('../features/overview/OverviewPage')),
  resistance: lazy(() => import('../features/resistance/ResistancePage')),
  antibioticUse: lazy(() => import('../features/antibiotic-use/AntibioticUsePage')),
  hai: lazy(() => import('../features/hai/HaiPage')),
  international: lazy(() => import('../features/international/InternationalPage')),
  data: lazy(() => import('../features/data-api/DataApiPage')),
  resources: lazy(() => import('../features/resources/ResourcesPage')),
  about: lazy(() => import('../features/methodology/MethodologyPage')),
  chat: lazy(() => import('../features/chatbot/ChatPage')),
};

export const ROUTES: readonly AppRoute[] = NAV.map((n) => ({ ...n, Component: pages[n.key] }));

export const NotFoundPage = lazy(() => import('../components/layout/NotFound'));
