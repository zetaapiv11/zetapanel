import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We mock global fetch and set a fake API key so renderRequest exercises
// its real retry/error-mapping logic without hitting the network.
describe('renderRequest', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.RENDER_API_KEY;

  beforeEach(() => {
    process.env.RENDER_API_KEY = 'rnd_test_key';
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.RENDER_API_KEY = originalKey;
  });

  it('throws RenderApiError with the upstream message on a 4xx response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
      text: async () => JSON.stringify({ message: 'Service not found' }),
    });

    const { renderRequest, RenderApiError } = await import('../src/services/render/renderClient.js');
    await expect(renderRequest('/services/does-not-exist')).rejects.toBeInstanceOf(RenderApiError);
    await expect(renderRequest('/services/does-not-exist')).rejects.toThrow('Service not found');
  });

  it('retries on 5xx and eventually succeeds', async () => {
    let calls = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      calls += 1;
      if (calls < 2) {
        return { ok: false, status: 503, headers: new Headers(), text: async () => '' };
      }
      return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify({ id: 'srv-1' }) };
    });

    const { renderRequest } = await import('../src/services/render/renderClient.js');
    const { data } = await renderRequest('/services/srv-1');
    expect(data.id).toBe('srv-1');
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('refuses to run without RENDER_API_KEY configured', async () => {
    delete process.env.RENDER_API_KEY;
    const { renderRequest, RenderApiError } = await import('../src/services/render/renderClient.js');
    await expect(renderRequest('/services')).rejects.toBeInstanceOf(RenderApiError);
  });
});
