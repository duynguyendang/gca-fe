export const API_CONFIG = {
  DEFAULT_BASE_URL: import.meta.env.VITE_GCA_API_BASE_URL || import.meta.env.GCA_API_BASE_URL || '',
  TIMEOUT: {
    DEFAULT: 30000,
    SHORT: 5000,
    LONG: 60000,
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
