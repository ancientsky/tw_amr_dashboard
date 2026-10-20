import { createContext, useContext } from 'react';

export type HeadingLevel = 2 | 3 | 4 | 5 | 6;

/**
 * Document-outline level for card titles: pages own the h1, a titled `Section` renders an h2 and
 * raises its children to 3, so a ChartCard is h2 directly under the page header and h3 inside a
 * section (no skipped heading levels).
 */
export const HeadingLevelContext = createContext<HeadingLevel>(2);

export function useHeadingLevel(): HeadingLevel {
  return useContext(HeadingLevelContext);
}
