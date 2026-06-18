export const API_CONFIG = {
  DEFAULT_BASE_URL: import.meta.env.VITE_GCA_API_BASE_URL || import.meta.env.GCA_API_BASE_URL || '',
  TIMEOUT: {
    DEFAULT: 30000,
    SHORT: 5000,
    LONG: 35000,
  },
};

export const UI_CONFIG = {
  DEBOUNCE_DELAY: 800,
  BLUR_DELAY: 200,
  ANIMATION_DELAY: 800,
  MIN_SEARCH_LENGTH: 2,
  HISTORY_LIMIT: 10,
  HIGHLIGHT_TIMEOUT: 2000,
  AUTO_CLUSTER_THRESHOLD: 300,
};

export const EXTERNAL_URLS = {
  YOUTUBE_DEMO: 'https://www.youtube.com/watch?v=z3oDvCIMDYI',
  NOISE_SVG: 'https://grainy-gradients.vercel.app/noise.svg',
};

export const EXPLAIN_CODE_QUERY = 'Explain this code';

export const OKF_PREDICATES = {
  CONCEPT: 'okf_concept',
  TITLE: 'okf_title',
  DESCRIPTION: 'okf_description',
  BRIDGE: 'bridges_to',
  LINK: 'okf_link',
  SMELL_TYPE: 'has_smell_type',
  ROLE: 'has_role',
};

export const CUSTOM_EVENTS = {
  FOCUS_SEARCH: 'gca:focus-search',
  OPEN_SETTINGS: 'gca:open-settings',
  REFRESH_DASHBOARD: 'gca:refresh-dashboard',
  NODE_SELECTED: 'gca:node-selected',
} as const;

export const INTENT_TYPES = {
  WHO_CALLS: 'who_calls',
  WHAT_CALLS: 'what_calls',
  HOW_REACHES: 'how_reaches',
  SUMMARIZE: 'summarize',
  EXPLAIN: 'explain',
  FIND: 'find',
  SECURITY: 'security_audit',
  REFACTOR: 'refactor',
  TEST_GEN: 'test_generation',
  PERFORMANCE: 'performance',
  CHAT: 'chat',
} as const;

export const INTENT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  who_calls: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', label: 'Callers' },
  what_calls: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'Callees' },
  how_reaches: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Reachability' },
  summarize: { bg: 'bg-teal-500/20', text: 'text-teal-400', label: 'Summary' },
  explain: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Explain' },
  find: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Find' },
  security_audit: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Security' },
  refactor: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Refactor' },
  test_generation: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Test Gen' },
  performance: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Performance' },
  explore: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'Explore' },
  navigate: { bg: 'bg-violet-500/20', text: 'text-violet-400', label: 'Navigate' },
  chat: { bg: 'bg-slate-500/20', text: 'text-slate-400', label: 'Chat' },
  search: { bg: 'bg-teal-500/20', text: 'text-teal-400', label: 'Search' },
} as const;
