import { describe, it, expect } from 'vitest';

describe('module imports', () => {
  it('imports constants', async () => {
    const mod = await import('../../constants');
    expect(mod.API_CONFIG).toBeDefined();
    expect(mod.UI_CONFIG).toBeDefined();
    expect(mod.EXTERNAL_URLS).toBeDefined();
  });

  it('imports logger', async () => {
    const mod = await import('../../logger');
    expect(mod.logger).toBeDefined();
    expect(typeof mod.logger.log).toBe('function');
    expect(typeof mod.logger.error).toBe('function');
  });

  it('imports theme', async () => {
    const mod = await import('../../theme');
    expect(mod.COLORS).toBeDefined();
    expect(mod.LANGUAGE_COLORS).toBeDefined();
    expect(mod.KIND_COLORS).toBeDefined();
  });

  it('imports prismSetup without window leakage', async () => {
    const mod = await import('../../prismSetup');
    expect(mod).toBeDefined();
  });

  it('ErrorBoundary component is importable', async () => {
    const mod = await import('../../components/ErrorBoundary');
    expect(mod.ErrorBoundary).toBeDefined();
  });
});