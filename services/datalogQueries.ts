const INTROSPECTION_ACTION_KEYWORDS = [
  'list', 'show', 'find', 'what', 'which', 'how many', 'count', 'get all',
];

const INTROSPECTION_ENTITY_KEYWORDS = [
  'api', 'endpoints', 'routes', 'handlers', 'functions', 'files',
  'imports', 'calls', 'called by', 'depend',
  'struct', 'interface', 'func', 'method', 'variable', 'constant',
  'package', 'module',
];

const CHAT_KEYWORDS = [
  'explain', 'describe', 'what is', 'how does', 'why', 'tell me about',
  'what does', 'help', 'debug', 'fix', 'error',
];

export function isIntrospectionQuery(query: string): boolean {
  const q = query.toLowerCase().trim();

  const hasAction = INTROSPECTION_ACTION_KEYWORDS.some(kw => q.includes(kw));
  const hasEntity = INTROSPECTION_ENTITY_KEYWORDS.some(k => q.includes(k));
  const hasChatKeyword = CHAT_KEYWORDS.some(kw => q.startsWith(kw));

  return hasAction && hasEntity && !hasChatKeyword;
}

export function isValidIntrospectionQuery(query: string): boolean {
  const q = query.trim();
  if (!q || q.length < 3) {
    return false;
  }

  const hasAlphanumeric = /[a-zA-Z0-9]/.test(q);
  if (!hasAlphanumeric) {
    return false;
  }

  const gibberish = /^[a-z]{1,3}$/.test(q.toLowerCase());
  if (gibberish) {
    return false;
  }

  return true;
}