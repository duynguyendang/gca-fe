import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../context/SettingsContext', () => ({
  useSettingsContext: vi.fn(),
}));

vi.mock('../../context/GraphContext', () => ({
  useGraphContext: vi.fn(),
}));

vi.mock('../../utils/fetchWithTimeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock('../../utils/requestManager', () => ({
  requestManager: {
    startRequest: vi.fn(() => ({ signal: new AbortController().signal })),
    cancelRequest: vi.fn(),
    cancelAll: vi.fn(),
  },
}));

import { useSettingsContext } from '../../context/SettingsContext';
import { useGraphContext } from '../../context/GraphContext';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { useNodeHydration } from '../useNodeHydration';

const mockFetchWithTimeout = fetchWithTimeout as ReturnType<typeof vi.fn>;
const mockUseSettingsContext = useSettingsContext as ReturnType<typeof vi.fn>;
const mockUseGraphContext = useGraphContext as ReturnType<typeof vi.fn>;

function mockResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(''),
  } as Response;
}

describe('useNodeHydration', () => {
  const setHydratingNodeId = vi.fn();
  const setSymbolCache = vi.fn();
  const setAstData = vi.fn();
  const symbolCache = new Map();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSettingsContext.mockReturnValue({
      dataApiBase: 'http://localhost:8080',
      selectedProjectId: 'testproj',
    });
    mockUseGraphContext.mockReturnValue({
      setHydratingNodeId,
      symbolCache,
      setSymbolCache,
      astData: { nodes: [], links: [] },
      setAstData,
    });
  });

  it('returns hydrateNode function', () => {
    const { result } = renderHook(() => useNodeHydration());
    expect(result.current.hydrateNode).toBeInstanceOf(Function);
  });

  it('skips invalid nodeId (empty)', async () => {
    const { result } = renderHook(() => useNodeHydration());
    const res = await act(async () => result.current.hydrateNode(''));
    expect(res).toBeNull();
    expect(mockFetchWithTimeout).not.toHaveBeenCalled();
  });

  it('skips invalid nodeId (comment prefix)', async () => {
    const { result } = renderHook(() => useNodeHydration());
    const res1 = await act(async () => result.current.hydrateNode('// comment'));
    expect(res1).toBeNull();
    const res2 = await act(async () => result.current.hydrateNode('/* block'));
    expect(res2).toBeNull();
  });

  it('skips nodeId with newline', async () => {
    const { result } = renderHook(() => useNodeHydration());
    const res = await act(async () => result.current.hydrateNode('bad\nnode'));
    expect(res).toBeNull();
  });

  it('fetches from API for uncached node', async () => {
    mockFetchWithTimeout.mockResolvedValue(mockResponse({ id: 'node1', code: 'func main() {}' }));

    const { result } = renderHook(() => useNodeHydration());
    const res = await act(async () => result.current.hydrateNode('node1'));

    expect(res).toEqual({ id: 'node1', code: 'func main() {}' });
    expect(mockFetchWithTimeout).toHaveBeenCalled();
    expect(setHydratingNodeId).toHaveBeenCalledWith('node1');
  });

  it('returns null when API fails (uses distinct projectId to avoid cache)', async () => {
    mockUseSettingsContext.mockReturnValue({
      dataApiBase: 'http://localhost:8080',
      selectedProjectId: 'fail-project',
    });
    mockFetchWithTimeout.mockResolvedValue(mockResponse(null, false, 500));

    const { result } = renderHook(() => useNodeHydration());
    const res = await act(async () => result.current.hydrateNode('node-fail'));

    expect(res).toBeNull();
  });
});
