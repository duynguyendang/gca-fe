const INTROSPECTION_KEYWORDS = [
  'list', 'show', 'find', 'what', 'which', 'how many', 'count', 'get all',
  'api', 'endpoints', 'routes', 'handlers', 'functions', 'files',
  'imports', 'calls', 'called by', 'depend',
];

const INTROSPECTION_KINDS = [
  'struct', 'interface', 'func', 'method', 'variable', 'constant',
  'package', 'file', 'module',
];

export function isIntrospectionQuery(query: string): boolean {
  const q = query.toLowerCase().trim();

  const hasKeyword = INTROSPECTION_KEYWORDS.some(kw => q.includes(kw));
  const hasKind = INTROSPECTION_KINDS.some(k => q.includes(k));

  return hasKeyword && hasKind;
}