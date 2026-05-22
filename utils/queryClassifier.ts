// Intent classification for query routing
// ClassifyQueryMode, classifyIntentRoute extracted from App.tsx

export type QueryMode = 'explore' | 'explain' | 'navigate';
export type IntentRoute = 'explore' | 'explain' | 'navigate' | 'test' | 'security' | 'refactor' | 'performance';

export function classifyQueryMode(query: string): QueryMode {
  const q = query.toLowerCase();

  const explorePatterns = [
    /show\s+(me\s+)?(callers|callees|dependencies)/i,
    /(who|caller|calling)\s+calls/i,
    /(what|callee|called)\s+calls/i,
    /trace\s+(the\s+)?(call|code|execution)/i,
    /call\s+graph/i,
    /dependencies/i,
    /upstream|downstream/i,
    /impact.*analysis/i,
    /blast.*radius/i,
  ];

  for (const pattern of explorePatterns) {
    if (pattern.test(q)) return 'explore';
  }

  const navigatePatterns = [
    /\.(go|ts|tsx|js|jsx|py)$/,
    /\/[a-zA-Z0-9_.-]+$/,
    /^src\//m,
    /^pkg\//m,
    /^cmd\//m,
  ];

  for (const pattern of navigatePatterns) {
    if (pattern.test(q)) return 'navigate';
  }

  return 'explain';
}

export function classifyIntentRoute(query: string): IntentRoute {
  const q = query.toLowerCase();

  const testPatterns = [
    /write.*test/i,
    /unit test/i,
    /integration test/i,
    /test.*coverage/i,
    /generate.*test/i,
    /test.*generation/i,
    /create.*test/i,
  ];

  for (const pattern of testPatterns) {
    if (pattern.test(q)) return 'test';
  }

  const securityPatterns = [
    /security/i,
    /vulnerabilit/i,
    /audit/i,
    /injection/i,
    /sql.*inject/i,
    /xss/i,
    /csrf/i,
    /authent/i,
    /authoriz/i,
    /sanitiz/i,
    /crypto/i,
    /secret/i,
    /password/i,
    /api.*key/i,
  ];

  for (const pattern of securityPatterns) {
    if (pattern.test(q)) return 'security';
  }

  const refactorPatterns = [
    /refactor/i,
    /technical debt/i,
    /improve.*code/i,
    /simplif/i,
    /reorganiz/i,
    /restructure/i,
    /code smell/i,
    /cyclic.*complexit/i,
  ];

  for (const pattern of refactorPatterns) {
    if (pattern.test(q)) return 'refactor';
  }

  const performancePatterns = [
    /performance/i,
    /bottleneck/i,
    /optimi/i,
    /slow/i,
    /memory leak/i,
    /cpu/i,
    /latency/i,
  ];

  for (const pattern of performancePatterns) {
    if (pattern.test(q)) return 'performance';
  }

  return classifyQueryMode(query) as IntentRoute;
}