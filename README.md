# GCA Frontend

**Interactive Graph-Based Code Explorer** with AI-Powered Analysis

The GCA Frontend is a React application that visualizes code as an interactive knowledge graph, enabling intuitive code exploration through natural language queries and AI-powered insights.

## Features

### Natural Language Code Exploration

Unlike traditional code browsers that require you to know exactly where code lives, GCA lets you ask questions naturally:

- **"Where is authentication handled?"** → Shows all auth-related files and symbols
- **"What calls this function?"** → Visualizes the entire call graph
- **"Explain how data flows through this module"** → Traces paths with AI commentary

### Unified Graph + AI Experience

Most tools show you code OR let you ask questions. GCA combines both:

- Click any node to see code
- Ask AI to explain that code in context
- See relationships visually while AI narrates the flow
- Get suggestions for follow-up questions based on what you're viewing

### Multiple Perspectives, One Tool

| View | When to Use |
| ---- | ----------- |
| **Discovery** | Free exploration — "What connects to X?" |
| **Architecture** | Understanding structure — "What's the overall design?" |
| **Map** | Large codebases — "Where are the main clusters?" |
| **Narrative** | Deep dive — "Walk me through this flow step by step" |

### Visual Code Intelligence

- **Color-coded nodes**: Files, functions, structs, interfaces each have distinct styling
- **Gateway highlighting**: Entry points (main, init) and exit points are highlighted
- **Dependency paths**: Trace exactly how code flows from A to B
- **Zoom to any scale**: From entire codebase to single function

### Smart Search

- **Natural Language Queries**: Ask like you're talking to a colleague
- **Automatic Query Routing**: Datalog for precise lookups, semantic search for conceptual matches
- **Search History**: Quickly rerun previous queries
- **AI Synthesis**: Results come with explanations, not just raw data

### Performance at Scale

- **Auto-Clustering**: Maps enable navigation at >300 nodes without overwhelming visualization
- **Virtual Rendering**: Only visible nodes are rendered, even in massive graphs
- **Debounced Search**: No unnecessary API calls while typing
- **Incremental Loading**: File details load on-demand, not upfront

## Quick Start

### Prerequisites

- Node.js 18+
- GCA Backend running on `http://localhost:8080` (or configure custom URL)

### Installation

```bash
npm install
npm run dev
```

The app opens at `http://localhost:5173` and automatically connects to the backend.

## Usage

### Project Selection

Projects load automatically on page load. Switch projects using the dropdown in the top-left corner.

### Search

Enter natural language queries in the search bar:

- `"who calls Server.handleAIAsk?"`
- `"functions that parse datalog"`
- `"graph rendering logic"`

### Navigate the Graph

- **Click nodes** to view code and documentation
- **Expand files** to see all symbols within
- **Click ANALYZE** to get AI insights about a symbol

### View Modes

Switch between visualization modes:

- **Discovery**: Explore relationships with force-directed layout
- **Architecture**: See high-level system structure and dependencies
- **Map**: Visualizes code clusters with auto-clustering at >300 nodes

## Tech Stack

- **React 19** with TypeScript
- **D3.js** for force-directed graph visualization
- **Vite** for fast builds and hot reload
- **Framer Motion** for animations
- **Lucide React** for icons
- **React Markdown** for rendering AI responses

## Architecture

### Key Components

| Component | Purpose |
| --------- | ------- |
| `App.tsx` | Main orchestrator: project/file management, view switching, graph coordination |
| `TreeVisualizer/` | D3-powered graph with force simulation, zoom/pan, node selection |
| `NarrativeScreen/` | Chat-style AI interaction with context-aware suggestions |
| `Layout/` | Code panel, synthesis panel, sidebar navigation |
| `SearchBar.tsx` | Natural language query input with history |

### Services

| Service | Purpose |
| ------- | ------- |
| `graphService.ts` | Graph data fetching, Datalog queries, source retrieval |
| `geminiService.ts` | Unified AI ask pipeline (NL → Datalog → LLM) |

### State Management

Global state via `AppContext`:

- `dataApiBase`: Backend URL
- `selectedProjectId`: Current project
- `astData`: Graph nodes/links
- `viewMode`: Current visualization mode
- `nodeInsight`: AI analysis text

## Configuration

### Environment Variables

Create `.env.local`:

```bash
VITE_GCA_API_BASE_URL=http://localhost:8080
```

The API URL can also be configured via:

1. Settings panel in the UI
2. `sessionStorage` (persisted between sessions)

## Performance

- **Initial Load**: <2s with auto-connect
- **Graph Render**: <100ms for 1000 nodes
- **Auto-Clustering**: Automatically enables Map mode at >300 nodes

## Troubleshooting

### Backend Not Connected

- Verify GCA backend is running on port 8080
- Check API URL in Settings panel
- Check browser console for CORS errors

### Graph Not Rendering

- Clear browser cache and sessionStorage
- Check browser console for errors
- Try hard refresh (Ctrl+Shift+R)

## License

Apache License 2.0 - see LICENSE file for details
