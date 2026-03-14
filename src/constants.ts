export const API_CONFIG = {
  DEFAULT_BASE_URL: 'https://gca-be-180036253374.us-central1.run.app',
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

export const CDN_URLS = {
  PRISM_CSS: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css',
  PRISM_JS: 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js',
  PRISM_COMPONENT: (lang: string) => `https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-${lang}.min.js`,
};

export const EXTERNAL_URLS = {
  YOUTUBE_DEMO: 'https://www.youtube.com/watch?v=z3oDvCIMDYI',
  NOISE_SVG: 'https://grainy-gradients.vercel.app/noise.svg',
};
