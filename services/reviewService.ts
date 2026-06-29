import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import type {
  ReviewSessionCreateRequest,
  ReviewSessionCreateResponse,
  ReviewSessionQueryRequest,
  ReviewSessionQueryResponse,
} from '../types';

function cleanBase(base: string): string {
  return base.replace(/\/+$/, '');
}

export async function createReviewSession(
  dataApiBase: string,
  projectId: string,
  diff: string,
  baseCommit?: string,
  headCommit?: string,
): Promise<ReviewSessionCreateResponse> {
  const url = `${cleanBase(dataApiBase)}/api/v1/review/session`;
  const body: ReviewSessionCreateRequest = {
    project_id: projectId,
    diff,
    base_commit: baseCommit,
    head_commit: headCommit,
  };
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Review session creation failed: ${errBody || response.statusText}`);
  }
  return response.json();
}

export async function queryReviewSession(
  dataApiBase: string,
  sessionId: string,
  query: string,
  projectId: string,
): Promise<ReviewSessionQueryResponse> {
  const url = `${cleanBase(dataApiBase)}/api/v1/review/session/${sessionId}/query`;
  const body: ReviewSessionQueryRequest = { query, project_id: projectId };
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Review session query failed: ${errBody || response.statusText}`);
  }
  return response.json();
}
