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

import { useSettingsContext } from '../../context/SettingsContext';
import { useGraphContext } from '../../context/GraphContext';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { useApiSync } from '../useApiSync';

const mockFetchWithTimeout = fetchWithTimeout as ReturnType<typeof vi.fn>;
const mockUseSettingsContext = useSettingsContext as ReturnType<typeof vi.fn>;
const mockUseGraphContext = useGraphContext as ReturnType<typeof vi.fn>;

function mockResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(ok ? '' : JSON.stringify(data)),
  } as Response;
}

describe('useApiSync', () => {
  const setAstData = vi.fn();
  const setFileScopedNodes = vi.fn();
  const setFileScopedLinks = vi.fn();
  const setSelectedNode = vi.fn();
  const setExpandedFileIds = vi.fn();
  const setIsDataSyncing = vi.fn();
  const setSyncError = vi.fn();
  const setAvailableProjects = vi.fn();
  const setSelectedProjectId = vi.fn();
  const setCurrentProject = vi.fn();
  const setSandboxFiles = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSettingsContext.mockReturnValue({
      enableAutoClustering: false,
      setIsDataSyncing,
      setSyncError,
      setAvailableProjects,
      setSelectedProjectId,
      setCurrentProject,
      setSandboxFiles,
      dataApiBase: 'http://localhost:8080',
    });
    mockUseGraphContext.mockReturnValue({
      setAstData,
      setFileScopedNodes,
      setFileScopedLinks,
      setSelectedNode,
      setExpandedFileIds,
    });
  });

  it('returns syncDataFromApi function', () => {
    const { result } = renderHook(() => useApiSync());
    expect(result.current.syncDataFromApi).toBeInstanceOf(Function);
  });

  it('fetches projects and updates state on successful sync', async () => {
    const projects = [{ id: 'proj1', name: 'Proj 1' }];
    mockFetchWithTimeout
      .mockResolvedValueOnce(mockResponse(projects))
      .mockResolvedValueOnce(mockResponse(['file1.go', 'file2.go']))
      .mockResolvedValueOnce(mockResponse({ nodes: [], links: [] }));

    const { result } = renderHook(() => useApiSync());

    await act(async () => {
      await result.current.syncDataFromApi('http://localhost:8080');
    });

    expect(setAvailableProjects).toHaveBeenCalledWith(projects);
    expect(setSelectedProjectId).toHaveBeenCalledWith('proj1');
    expect(setIsDataSyncing).toHaveBeenCalledWith(false);
  });

  it('sets sync error when projects fetch fails', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(mockResponse(null, false, 500));

    const { result } = renderHook(() => useApiSync());

    await act(async () => {
      await result.current.syncDataFromApi('http://localhost:8080');
    });

    expect(setSyncError).toHaveBeenCalled();
    expect(setIsDataSyncing).toHaveBeenCalledWith(false);
  });

  it('exits early when baseUrl is empty', async () => {
    const { result } = renderHook(() => useApiSync());

    await act(async () => {
      await result.current.syncDataFromApi('');
    });

    expect(setIsDataSyncing).not.toHaveBeenCalled();
  });
});
