import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
        '/v1': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
    envPrefix: ['VITE_', 'GCA_'],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },

    build: {
      rollupOptions: {
        output: {
          // Manual vendor chunking. Goals:
          //  - Keep main app bundle small (most app code is route/view specific
          //    and will be lazy-loaded via React.lazy in App.tsx).
          //  - Isolate large 3rd-party libs so they cache independently of app code.
          //  - Prevent re-downloading heavy syntax-highlighting / markdown deps
          //    for users who never open the code panel or narrative screen.
          //
          // Important: chunks must remain mutually exclusive in their imports so
          // Rollup does not duplicate modules. We split by entry point package.
          manualChunks: {
            // Core React + router — needed for everything.
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],

            // D3 is heavy (~67 KB gz) but is used both by the architecture
            // (ClassDiagramCanvas) and the discovery graph (DiscoveryGraph +
            // PaginatedGraphVisualization). Shared chunk so they share one fetch.
            'vendor-d3': ['d3'],

            // Markdown rendering — only loaded when NarrativeScreen or
            // CodePanel mount. Together this is ~250 KB raw.
            'vendor-markdown': ['react-markdown', 'remark-gfm', 'dompurify'],

            // Syntax highlighting — only loaded when HighlightedCode mounts.
            // Includes Prism core + language packs imported by prismSetup.ts.
            'vendor-syntax': ['prismjs'],

            // Charts — used by Dashboard panels (RiskLeaderboard / MetricsRadar).
            // ~150 KB raw but cached separately because it's only dashboard.
            'vendor-charts': ['recharts'],

            // Graph layout — used only by ClassDiagramCanvas (architecture view).
            'vendor-graph': ['dagre'],
          },
        },
      },

      // Warn earlier so chunks stay under control as the app grows.
      chunkSizeWarningLimit: 600,
    },
  };
});
