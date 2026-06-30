import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/fetchWithTimeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import { fetchProjects, fetchSummary, executeQuery } from '../graphService';

const mockFetchWithTimeout = fetchWithTimeout as ReturnType<typeof vi.fn>;

function mockResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(ok ? '' : JSON.stringify(data)),
  } as Response;
}

describe('graphService request<T>', () => {
  beforeEach(() => {
    mockFetchWithTimeout.mockReset();
  });

  it('fetchProjects returns project list', async () => {
    const projects = [{ id: 'p1', name: 'Project 1' }];
    mockFetchWithTimeout.mockResolvedValue(mockResponse(projects));
    const result = await fetchProjects('http://localhost:8080');
    expect(result).toEqual(projects);
    expect(mockFetchWithTimeout).toHaveBeenCalledTimes(1);
  });

  it('fetchProjects passes signal', async () => {
    const projects = [{ id: 'p1', name: 'Project 1' }];
    mockFetchWithTimeout.mockResolvedValue(mockResponse(projects));
    const controller = new AbortController();
    const result = await fetchProjects('http://localhost:8080', controller.signal);
    expect(result).toEqual(projects);
  });

  it('fetchSummary passes project param', async () => {
    const summary = { project_name: 'Test', total_facts: 42, top_symbols: [] };
    mockFetchWithTimeout.mockResolvedValue(mockResponse(summary));
    const result = await fetchSummary('http://localhost:8080', 'testproj');
    expect(result).toEqual(summary);
  });

  it('throws on non-ok response', async () => {
    mockFetchWithTimeout.mockResolvedValue(mockResponse({ error: 'not found' }, false, 404));
    await expect(fetchProjects('http://localhost:8080')).rejects.toThrow('API Error 404');
  });

  it('executeQuery sends POST with body', async () => {
    const resp = { nodes: [], links: [] };
    mockFetchWithTimeout.mockResolvedValue(mockResponse(resp));
    const result = await executeQuery('http://localhost:8080', 'testproj', 'triples(?S, ?P, ?O)');
    expect(result).toEqual(resp);
    expect(mockFetchWithTimeout).toHaveBeenCalled();
    const callArgs = mockFetchWithTimeout.mock.calls[0]!;
    expect(callArgs[0] as string).toContain('/api/v1/query');
    const opts = callArgs[1] as RequestInit;
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body as string)).toEqual({ query: 'triples(?S, ?P, ?O)' });
  });

  it('executeQuery sanitizes long input', async () => {
    const longQuery = 'x'.repeat(6000);
    const resp = { nodes: [], links: [] };
    mockFetchWithTimeout.mockResolvedValue(mockResponse(resp));
    const result = await executeQuery('http://localhost:8080', 'testproj', longQuery);
    expect(result).toEqual(resp);
  });
});
