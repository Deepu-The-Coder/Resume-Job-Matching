import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';

const jobModel = vi.hoisted(() => ({
  findOne: vi.fn(),
  create: vi.fn(),
}));
const embedText = vi.hoisted(() => vi.fn().mockResolvedValue([0.1, 0.2]));

vi.mock('../models/Job.js', () => ({ Job: jobModel, default: jobModel }));
vi.mock('../services/embeddingService.js', () => ({ embedText, default: { embedText } }));

describe('job endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    jobModel.findOne.mockResolvedValue(null);
    jobModel.create.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      tenantId: 'tenant-a',
      title: 'Backend Engineer',
      description: 'Build APIs',
      requiredSkills: ['node.js'],
      contentHash: 'hash',
      embedding: [0.1, 0.2],
      embeddingModel: 'test-model',
      postedBy: new mongoose.Types.ObjectId(),
      toObject() {
        return { ...this };
      },
    });
  });

  it('creates a tenant-scoped job and omits the embedding from the response', async () => {
    const { default: app } = await import('../app.js');
    const response = await request(app)
      .post('/api/jobs')
      .set('x-tenant-id', 'tenant-a')
      .send({
        title: 'Backend Engineer',
        description: 'Build APIs',
        requiredSkills: ['node.js'],
        postedBy: new mongoose.Types.ObjectId().toString(),
      });

    expect(response.status).toBe(201);
    expect(response.body.job.embedding).toBeUndefined();
    expect(jobModel.create).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-a',
      title: 'Backend Engineer',
    }));
    expect(embedText).toHaveBeenCalledOnce();
  });
});
