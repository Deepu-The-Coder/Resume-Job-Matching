import { beforeEach, describe, expect, it, vi } from 'vitest';

const { embedText, find, updateOne } = vi.hoisted(() => ({
  embedText: vi.fn(),
  find: vi.fn(),
  updateOne: vi.fn(),
}));
const resume = { _id: 'resume-1', parsedText: 'Node.js developer' };

vi.mock('../services/embeddingService.js', () => ({ embedText }));
vi.mock('../models/index.js', () => ({
  Resume: { find, updateOne },
  Job: { find: vi.fn(), findOne: vi.fn() },
  Match: { findOneAndUpdate: vi.fn() },
}));

describe('embedding worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    find.mockResolvedValue([resume]);
    updateOne.mockResolvedValue({ acknowledged: true });
  });

  it('processes a bulk embedding job and reports progress', async () => {
    embedText.mockResolvedValue([0.1, 0.2]);
    const { processQueueJob } = await import('../workers/embeddingWorker.js');
    const updateProgress = vi.fn();

    const result = await processQueueJob({
      name: 'bulk-embed',
      data: { tenantId: 'tenant-a', type: 'resume', ids: ['resume-1'] },
      updateProgress,
    });

    expect(result.processed).toBe(1);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'resume-1', tenantId: 'tenant-a' },
      { $set: { embedding: [0.1, 0.2], embeddingModel: expect.any(String) } }
    );
    expect(updateProgress).toHaveBeenLastCalledWith(100);
  });

  it('rejects repeated failures so BullMQ retries and dead-letters the job', async () => {
    embedText.mockRejectedValue(new Error('embedding provider unavailable'));
    const { processQueueJob } = await import('../workers/embeddingWorker.js');
    const queueJob = {
      name: 'bulk-embed',
      data: { tenantId: 'tenant-a', type: 'resume', ids: ['resume-1'] },
      updateProgress: vi.fn(),
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(processQueueJob(queueJob)).rejects.toThrow('embedding provider unavailable');
    }
    expect(embedText).toHaveBeenCalledTimes(3);
  });
});
