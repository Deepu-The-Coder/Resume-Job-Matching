import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const {
  enqueueBulkEmbed,
  enqueueBulkMatch,
  getQueueJob,
  listFailedQueueJobs,
} = vi.hoisted(() => ({
  enqueueBulkEmbed: vi.fn(),
  enqueueBulkMatch: vi.fn(),
  getQueueJob: vi.fn(),
  listFailedQueueJobs: vi.fn(),
}));

vi.mock('../queues/embeddingQueue.js', () => ({
  enqueueBulkEmbed,
  enqueueBulkMatch,
  getQueueJob,
  listFailedQueueJobs,
}));

describe('admin background job endpoints', () => {
  const tenantHeaders = { 'x-tenant-id': 'tenant-a' };

  beforeEach(() => {
    vi.clearAllMocks();
    enqueueBulkEmbed.mockResolvedValue('embed-job-1');
    enqueueBulkMatch.mockResolvedValue('match-job-1');
    getQueueJob.mockReset();
    listFailedQueueJobs.mockReset();
  });

  it('returns 202 immediately after enqueueing bulk embedding', async () => {
    const { default: app } = await import('../app.js');
    const response = await request(app)
      .post('/api/admin/bulk-embed')
      .set(tenantHeaders)
      .send({ tenantId: 'tenant-a', type: 'resume', ids: ['507f1f77bcf86cd799439011'] });

    expect(response.status).toBe(202);
    expect(response.body.jobId).toBe('embed-job-1');
    expect(enqueueBulkEmbed).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      type: 'resume',
      ids: ['507f1f77bcf86cd799439011'],
    });
  });

  it('returns 202 immediately after enqueueing bulk matching', async () => {
    const { default: app } = await import('../app.js');
    const response = await request(app)
      .post('/api/admin/bulk-match')
      .set(tenantHeaders)
      .send({ tenantId: 'tenant-a', jobId: '507f1f77bcf86cd799439011' });

    expect(response.status).toBe(202);
    expect(response.body.jobId).toBe('match-job-1');
  });

  it('reports progress and failed item details', async () => {
    getQueueJob.mockResolvedValue({
      id: 'embed-job-1',
      name: 'bulk-embed',
      progress: 50,
      attemptsMade: 1,
      failedReason: JSON.stringify({ failures: [{ id: 'resume-1', message: 'provider down' }] }),
      data: { tenantId: 'tenant-a' },
      getState: vi.fn().mockResolvedValue('failed'),
    });
    const { default: app } = await import('../app.js');
    const response = await request(app).get('/api/admin/jobs/embed-job-1').set(tenantHeaders);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'failed',
      progress: 50,
      failures: [{ id: 'resume-1', message: 'provider down' }],
    });
  });

  it('lists failed jobs as the dead-letter view', async () => {
    listFailedQueueJobs.mockResolvedValue([{
      id: 'failed-1',
      name: 'bulk-match',
      progress: 20,
      attemptsMade: 3,
      failedReason: 'job has no embedding',
      data: { tenantId: 'tenant-a' },
    }]);
    const { default: app } = await import('../app.js');
    const response = await request(app).get('/api/admin/failed-jobs').set(tenantHeaders);

    expect(response.status).toBe(200);
    expect(response.body.jobs[0]).toMatchObject({
      jobId: 'failed-1',
      status: 'failed',
      failures: [{ message: 'job has no embedding' }],
    });
  });
});
