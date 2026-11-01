import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordUsage = vi.fn().mockResolvedValue(null);

vi.mock('../services/usageTrackingService.js', () => ({
  recordUsage,
}));

describe('embedding wrapper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('records usage after receiving a valid embedding response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        embeddings: [[0.1, 0.2]],
        prompt_eval_count: 7,
      }),
    });

    const { embedText } = await import('../lib/embeddings.js');
    await expect(embedText('resume text', {
      tenantId: 'tenant-a',
      requestId: 'embedding-test',
    })).resolves.toEqual([0.1, 0.2]);

    expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a',
      type: 'embedding',
      tokensIn: 7,
      requestId: 'embedding-test',
    }));
  });
});
