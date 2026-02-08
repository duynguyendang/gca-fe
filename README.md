# GCA Frontend

**Interactive Graph-Based Code Explorer** with AI-Powered Analysis and Semantic Search

The GCA Frontend is a modern React application that visualizes code as an interactive knowledge graph, enabling intuitive code exploration through natural language queries and AI-powered insights.

![GCA Banner](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)

## Features

### 🔍 **Smart Search**
- **Natural Language Queries**: Ask questions like "who calls handlers?" or "functions that handle user input"
- **Automatic Datalog Translation**: AI converts your questions to graph queries
- **Semantic Fallback**: If Datalog finds nothing, automatically searches by semantic similarity
- **Search History**: Quickly access and manage your recent queries
- **AI Synthesis**: Results are analyzed and explained in natural language

### 🧠 **Semantic Search**
- **Documentation Embeddings**: Every symbol's documentation is embedded using Gemini `gemini-embedding-001`
- **Vector Similarity**: Find relevant code based on meaning, not just keywords
- **10 Results in <300ms**: Lightning fast with MRL-compressed vectors (768d → 64d int8)

### 📊 **Graph Visualization**
- **Multiple View Modes**:
  - **Discovery**: Force-directed graph for exploration
  - **Architecture**: Hierarchical backbone view showing cross-file dependencies
  - **Map View**: High-level clustered view (Leiden algorithm) for navigating large codebases (>300 nodes)
- **Cluster Expansion**: Click on cluster nodes in Map View to expand and view constituent files
- **Interactive Navigation**: Click nodes, expand files, trace relationships
- **Real-time Updates**: Graph updates as you search and explore

### 🤖 **AI Analysis**
- **Context-Aware**: AI receives actual code symbols, relationships, and documentation
- **Architectural Insights**: Get explanations of design patterns and component roles
- **Path Analysis**: Understand how components interact with traced execution paths

### ⚡ **Auto-Connect**
- **Zero-Click Setup**: Automatically connects to backend on page load
- **Source Navigator**: File explorer sidebar to easily browse and locate files in the graph
- **Session Persistence**: Remembers your API URL and selected project
- **Hot Reload**: Changes reflect instantly during development

## Quick Start

### Prerequisites
- Node.js 18+
- GCA Backend running on `http://localhost:8080` (or configure custom URL)

### Installation

```bash
# Install dependencies
npm install



# Start development server
npm run dev
```

The app will open at `http://localhost:3000` and **automatically connect** to the backend.

## Usage

### 1. **Project Selection**
- Projects are loaded automatically on page load
- Switch projects using the dropdown in the top-left corner

### 2. **Search**
Enter natural language queries in the search bar:
- `"who calls Server.handleAIAsk?"`
- `"functions that parse datalog"`
- `"graph rendering logic"`

### 3. **Navigate the Graph**
- **Click nodes** to view code and documentation
- **Expand files** to see all symbols within
- **Click ANALYZE** to get AI insights about a symbol

### 4. **View Modes**
Switch between visualization modes:
- **Discovery**: Explore relationships freely with force-directed layout
- **Architecture**: See high-level system structure and dependencies
- **Map**: Visualizes code clusters. Useful for large projects.
    - **Auto-Clustering**: Automatically enables Map mode when graph exceeds 300 nodes to preserve performance.

## Architecture

### Tech Stack
- **React 18** with TypeScript
- **D3.js** for force-directed graph visualization
- **Vite** for fast builds and hot reload
- **Zustand** for state management
- **Fetch API** for backend communication

### Key Components

#### `App.tsx`
Main application orchestrator handling:
- Project and file management
- View mode switching
- Graph data coordination

#### `TreeVisualizer`
D3-powered graph visualization with:
- Force simulation
- Interactive zoom/pan
- Node selection and highlighting

#### `hooks/useSmartSearch.ts`
Smart Search orchestration:
1. Translates NL → Datalog using Gemini
2. Executes Datalog query
3. Falls back to semantic search if empty
4. Analyzes results with AI

#### `hooks/useManifest.ts`
Loads compressed symbol manifest for fast client-side lookup

#### `services/graphService.ts`
API client for backend endpoints:
- Graph data fetching
- Semantic search
- Datalog queries
- Source code retrieval

### State Management

Global state via `AppContext`:
- `dataApiBase`: Backend URL
- `selectedProjectId`: Current project
- `astData`: Current graph nodes/links
- `viewMode`: Current visualization mode
- `nodeInsight`: AI analysis text

## Configuration

### Environment Variables

Create `.env.local`:
```bash


# Optional: Custom backend URL (default: http://localhost:8080)
GCA_API_BASE_URL=http://localhost:8080
```

### API URL
The API URL can be configured in:
1. `.env.local` (default)
2. Settings panel in the UI
3. `sessionStorage` (persisted between sessions)

## Development

### Code Structure
```
gca-fe/
├── src/
│   ├── App.tsx                 # Main app component
│   ├── components/             # UI components
│   │   ├── TreeVisualizer/     # Graph visualization
│   │   ├── Layout/             # Panels and layout
│   │   └── Synthesis/          # AI insights display
│   ├── hooks/                  # Custom React hooks
│   │   ├── useSmartSearch.ts  # Natural language search
│   │   ├── useManifest.ts     # Symbol manifest loader
│   │   └── useApiSync.ts      # Project sync logic
│   ├── services/              # API clients
│   │   ├── graphService.ts    # Graph API
│   │   └── geminiService.ts   # AI API
│   ├── context/               # Global state
│   │   └── AppContext.tsx     # App-wide context
│   └── types/                 # TypeScript types
│       └── index.ts           # Type definitions
└── public/                    # Static assets
```

### Adding New Features

**1. New API Endpoint:**
Add to `services/graphService.ts`:
```typescript
export async function fetchNewEndpoint(
  dataApiBase: string,
  projectId: string
): Promise<Response> {
  const url = `${dataApiBase}/v1/new-endpoint?project=${projectId}`;
  const response = await fetch(url);
  return await response.json();
}
```

**2. New Hook:**
Create in `hooks/useNewFeature.ts`:
```typescript
export const useNewFeature = () => {
  const { dataApiBase, selectedProjectId } = useAppContext();
  // Hook logic
  return { /* exports */ };
};
```

**3. New Component:**
Add to `components/NewComponent.tsx` and import in `App.tsx`

## Performance

### Optimizations
- **Lazy Loading**: File details loaded on-demand
- **Debounced Search**: Prevents excessive API calls
- **Memoized Calculations**: React.memo for expensive components
- **Virtual Rendering**: Only visible nodes are rendered in large graphs
- **Session Persistence**: Graph state cached in sessionStorage

### Benchmarks
- **Initial Load**: <2s (with auto-connect)
- **Search**: 200-500ms (Datalog) / 300ms (Semantic)
- **Graph Render**: <100ms for 1000 nodes
- **AI Analysis**: 2-8s (depends on context size)

## Troubleshooting

### Backend Not Connected
- Check that GCA backend is running on port 8080
- Verify API URL in Settings panel
- Check browser console for CORS errors

### Semantic Search Returns 0 Results
- Ensure backend was ingested with `GEMINI_API_KEY` set
- Re-ingest projects to generate embeddings
- Check that documentation exists for symbols

### Graph Not Rendering
- Clear browser cache and sessionStorage
- Check browser console for errors
- Try refreshing with Ctrl+Shift+R

## Contributing

We welcome contributions! Areas for improvement:
- Additional graph layout algorithms
- More AI prompts for different analysis types
- Performance optimizations for very large codebases
- Mobile-responsive design

## License

MIT License - see LICENSE file for details
