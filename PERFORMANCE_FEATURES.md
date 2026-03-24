# Frontend Performance Features

This document describes the new performance features added to the GCA frontend to match the backend optimizations.

## Pagination Support

### `usePaginatedGraph` Hook

Custom hook for managing paginated graph data with lazy loading.

```typescript
import { usePaginatedGraph } from '../hooks/usePaginatedGraph';

const {
  nodes,
  links,
  loading,
  error,
  hasMore,
  totalNodes,
  totalLinks,
  currentPage,
  loadMore,
  reset,
  loadPage
} = usePaginatedGraph(
  apiBase,      // API base URL
  projectId,    // Project ID
  query,        // Datalog query
  pageSize      // Page size (default: 100)
);
```

### Features:
- **Cursor-based pagination**: Efficient memory usage with stateless cursors
- **Load more**: Incremental loading of graph data
- **Direct page access**: Jump to specific pages
- **Reset**: Clear and reload data
- **Progress tracking**: Know total nodes vs loaded nodes

## Infinite Scroll

### `useInfiniteScroll` Hook

Automatically load more data as user scrolls to the bottom.

```typescript
import { useInfiniteScroll } from '../hooks/usePaginatedGraph';

const loadMoreTriggerRef = useInfiniteScroll(loadMore, hasMore, loading);

// Use in JSX
<div ref={loadMoreTriggerRef} />
```

## API Updates

### New Service Functions

#### `fetchPaginatedGraph`
Fetches paginated graph data with cursor support.

```typescript
import { fetchPaginatedGraph, PaginatedGraphOptions } from '../services/graphService';

const response = await fetchPaginatedGraph(
  apiBase,
  projectId,
  query,
  {
    cursor: 'base64-encoded-cursor',
    limit: 100,
    offset: 0
  }
);

// Response includes:
// - nodes: GraphMapNode[]
// - links: GraphMapLink[]
// - next_cursor: string | undefined
// - has_more: boolean
// - total_nodes: number
// - total_links: number
```

## Compression Support

### Automatic Response Compression

All API requests now include `Accept-Encoding: gzip` header automatically via the updated `fetchWithTimeout` utility.

The backend automatically compresses JSON responses, reducing bandwidth usage by 60-80% for large graph data.

## Example Usage

### Paginated Graph Component

```typescript
import { PaginatedGraphVisualization } from '../components/PaginatedGraphVisualization';

<PaginatedGraphVisualization
  apiBase={apiBase}
  projectId={projectId}
  query="triples(?s, 'defines', ?o)"}
  width={800}
  height={600}
  pageSize={100}
  onNodeClick={(node) => console.log('Clicked:', node)}
  onNodeHover={(node) => console.log('Hovered:', node)}
/>
```

### Custom Infinite Scroll Implementation

```typescript
function MyGraphView() {
  const {
    nodes,
    links,
    loading,
    hasMore,
    loadMore
  } = usePaginatedGraph(apiBase, projectId, query, 100);

  const triggerRef = useInfiniteScroll(loadMore, hasMore, loading);

  return (
    <div>
      <svg ref={svgRef} width={800} height={600}>
        {/* Render nodes and links */}
      </svg>

      {loading && <LoadingSpinner />}

      {hasMore && (
        <div ref={triggerRef} style={{ height: 20 }} />
      )}
    </div>
  );
}
```

## Performance Benefits

1. **Memory Efficiency**: Only loaded nodes are kept in memory
2. **Faster Initial Load**: First page loads quickly with default page size
3. **Reduced Bandwidth**: Gzip compression reduces data transfer by 60-80%
4. **Better UX**: Progressive loading keeps UI responsive
5. **Scalability**: Can handle graphs with 100,000+ nodes

## Migration Guide

### From Old Graph Loading

**Before:**
```typescript
const graph = await fetchFileGraph(apiBase, projectId, fileId);
// Loads entire graph at once - slow for large files
```

**After:**
```typescript
const {
  nodes,
  links,
  hasMore,
  loadMore
} = usePaginatedGraph(apiBase, projectId, query, 100);

// First 100 nodes load immediately, rest loads on demand
```

## Browser Compatibility

- Cursor-based pagination works in all modern browsers
- Infinite scroll uses IntersectionObserver API (supported in Chrome 51+, Firefox 55+, Safari 12.1+)
- Fallback: Manual "Load More" button shown if IntersectionObserver not available
