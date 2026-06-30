// Intent classification for query routing
// ClassifyQueryMode, classifyIntentRoute extracted from App.tsx
// Patterns loaded from gca-fe/data/queryPatterns.json

import queryPatterns from '../data/queryPatterns.json';

export type QueryMode = 'explore' | 'explain' | 'navigate';
export type IntentRoute = 'explore' | 'explain' | 'navigate' | 'test' | 'security' | 'refactor' | 'performance';

interface PatternEntry {
  source: string;
  flags: string;
}

function compilePatterns(entries: PatternEntry[]): RegExp[] {
  return entries.map(e => new RegExp(e.source, e.flags));
}

const explorePatterns = compilePatterns(queryPatterns.explorePatterns);
const navigatePatterns = compilePatterns(queryPatterns.navigatePatterns);
const testPatterns = compilePatterns(queryPatterns.testPatterns);
const securityPatterns = compilePatterns(queryPatterns.securityPatterns);
const refactorPatterns = compilePatterns(queryPatterns.refactorPatterns);
const performancePatterns = compilePatterns(queryPatterns.performancePatterns);

export function classifyQueryMode(query: string): QueryMode {
  const q = query.toLowerCase();

  for (const pattern of explorePatterns) {
    if (pattern.test(q)) return 'explore';
  }

  for (const pattern of navigatePatterns) {
    if (pattern.test(q)) return 'navigate';
  }

  return 'explain';
}

export function classifyIntentRoute(query: string): IntentRoute {
  const q = query.toLowerCase();

  for (const pattern of testPatterns) {
    if (pattern.test(q)) return 'test';
  }

  for (const pattern of securityPatterns) {
    if (pattern.test(q)) return 'security';
  }

  for (const pattern of refactorPatterns) {
    if (pattern.test(q)) return 'refactor';
  }

  for (const pattern of performancePatterns) {
    if (pattern.test(q)) return 'performance';
  }

  return classifyQueryMode(query) as IntentRoute;
}