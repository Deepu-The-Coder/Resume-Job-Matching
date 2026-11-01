import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';

const jobs = [
  {
    _id: 'job-a',
    tenantId: 'tenant-a',
    title: 'Tenant A Engineer',
    description: 'Private job A',
    requiredSkills: ['node.js'],
    embedding: [1, 0],
  },
  {
    _id: 'job-b',
    tenantId: 'tenant-b',
    title: 'Tenant B Engineer',
    description: 'Private job B',
    requiredSkills: ['python'],
    embedding: [0, 1],
  },
];

vi.mock('../models/Job.js', () => ({
  Job: {
    find: vi.fn((filter) => ({
      select: vi.fn().mockResolvedValue(jobs.filter((job) => job.tenantId === filter.tenantId)),
    })),
    findOne: vi.fn(),
  },
  default: {},
}));

vi.mock('../models/Resume.js', () => ({
  Resume: {
    findOne: vi.fn(),
    find: vi.fn(),
  },
  default: {},
}));

describe('tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not expose tenant B jobs to tenant A', async () => {
    const response = await request(app)
      .get('/api/jobs')
      .set('x-tenant-id', 'tenant-a');

    expect(response.status).toBe(200);
    expect(response.body.jobs).toHaveLength(1);
    expect(response.body.jobs[0].tenantId).toBe('tenant-a');
    expect(response.body.jobs[0].title).not.toContain('Tenant B');
  });
});
