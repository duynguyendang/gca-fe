import { describe, it, expect } from 'vitest';
import { classifyQueryMode, classifyIntentRoute } from '../queryClassifier';

describe('classifyQueryMode', () => {
  it('classifies explore patterns', () => {
    expect(classifyQueryMode('show me callers of handleUser')).toBe('explore');
    expect(classifyQueryMode('who calls AuthService')).toBe('explore');
    expect(classifyQueryMode('trace the call execution')).toBe('explore');
    expect(classifyQueryMode('call graph for project')).toBe('explore');
    expect(classifyQueryMode('dependencies of this module')).toBe('explore');
  });

  it('classifies navigate patterns', () => {
    expect(classifyQueryMode('handlers/user.go')).toBe('navigate');
    expect(classifyQueryMode('src/main.ts')).toBe('navigate');
    expect(classifyQueryMode('pkg/server/handlers.go')).toBe('navigate');
    expect(classifyQueryMode('cmd/app/main.go')).toBe('navigate');
  });

  it('defaults to explain for unknown patterns', () => {
    expect(classifyQueryMode('what does this code do')).toBe('explain');
    expect(classifyQueryMode('how is authentication handled')).toBe('explain');
    expect(classifyQueryMode('')).toBe('explain');
  });
});

describe('classifyIntentRoute', () => {
  it('classifies test patterns', () => {
    expect(classifyIntentRoute('write tests for handleUser')).toBe('test');
    expect(classifyIntentRoute('unit test coverage')).toBe('test');
    expect(classifyIntentRoute('generate test cases')).toBe('test');
  });

  it('classifies security patterns', () => {
    expect(classifyIntentRoute('security audit')).toBe('security');
    expect(classifyIntentRoute('sql injection vulnerability')).toBe('security');
    expect(classifyIntentRoute('authentication check')).toBe('security');
  });

  it('classifies refactor patterns', () => {
    expect(classifyIntentRoute('refactor this code')).toBe('refactor');
    expect(classifyIntentRoute('technical debt in handler')).toBe('refactor');
    expect(classifyIntentRoute('simplify the logic')).toBe('refactor');
  });

  it('classifies performance patterns', () => {
    expect(classifyIntentRoute('performance bottleneck')).toBe('performance');
    expect(classifyIntentRoute('optimize query')).toBe('performance');
    expect(classifyIntentRoute('memory leak detection')).toBe('performance');
  });

  it('falls back to query mode for unmatched routes', () => {
    expect(classifyIntentRoute('show callers')).toBe('explore');
    expect(classifyIntentRoute('handlers/user.go')).toBe('navigate');
    expect(classifyIntentRoute('what does this do')).toBe('explain');
  });
});
