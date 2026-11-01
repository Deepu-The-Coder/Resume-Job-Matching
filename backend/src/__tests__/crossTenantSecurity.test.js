import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const services = vi.hoisted(() => ({
  listJobs: vi.fn(),
  getJobById: vi.fn(),
  findJobsForResume: vi.fn(),
  findResumesForJob: vi.fn(),
  getStats: vi.fn(),
  getJobStatus: vi.fn(),
  getFailedJobs: vi.fn(),
  queueBulkEmbed: vi.fn(),
  queueBulkMatch: vi.fn(),
}));

vi.mock('../services/jobService.js', () => ({
  listJobs: services.listJobs,
  getJobById: services.getJobById,
  createJob: vi.fn(),
  serializeJob: (job) => job,
}));
vi.mock('../services/matchingService.js', () => ({
  findJobsForResume: services.findJobsForResume,
  findResumesForJob: services.findResumesForJob,
}));
vi.mock('../services/usageTrackingService.js', () => ({
  getStats: services.getStats,
}));
vi.mock('../services/adminJobService.js', () => ({
  queueBulkEmbed: services.queueBulkEmbed,
  queueBulkMatch: services.queueBulkMatch,
  getJobStatus: services.getJobStatus,
  getFailedJobs: services.getFailedJobs,
}));

describe('cross-tenant endpoint isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    services.listJobs.mockImplementation(({ tenantId }) => Promise.resolve([
      { tenantId, title: `${tenantId} job` },
    ]));
    services.getJobById.mockImplementation(({ tenantId }) => Promise.resolve({
      tenantId,
      title: `${tenantId} job`,
    }));
    services.findJobsForResume.mockImplementation((_id, { tenantId }) => Promise.resolve([
      { tenantId, title: `${tenantId} match` },
    ]));
    services.findResumesForJob.mockImplementation((_id, { tenantId }) => Promise.resolve([
      { tenantId, originalFilename: `${tenantId}.pdf` },
    ]));
    services.getStats.mockImplementation(({ tenantId }) => Promise.resolve({
      tenantId,
      recentRequests: [{ querySummary: `${tenantId} request` }],
    }));
    services.getJobStatus.mockImplementation((_id, tenantId) => Promise.resolve({
      tenantId,
      status: 'completed',
    }));
    services.getFailedJobs.mockImplementation((tenantId) => Promise.resolve([{ tenantId }]));
    services.queueBulkEmbed.mockResolvedValue('queue-1');
    services.queueBulkMatch.mockResolvedValue('queue-2');
  });

  it('uses the tenant header, never a conflicting query/body tenant, across reads, matches, cache-backed matches, stats, and admin jobs', async () => {
    const { default: app } = await import('../app.js');
    const headers = { 'x-tenant-id': 'tenant-a' };

    const responses = await Promise.all([
      request(app).get('/api/jobs?tenantId=tenant-b').set(headers),
      request(app).get('/api/jobs/507f1f77bcf86cd799439011?tenantId=tenant-b').set(headers),
      request(app).get('/api/resumes/507f1f77bcf86cd799439011/matches?tenantId=tenant-b').set(headers),
      request(app).get('/api/jobs/507f1f77bcf86cd799439011/matches?tenantId=tenant-b').set(headers),
      request(app).get('/api/stats?tenantId=tenant-b').set(headers),
      request(app).get('/api/admin/jobs/queue-1').set(headers),
      request(app).get('/api/admin/failed-jobs').set(headers),
      request(app).post('/api/admin/bulk-match').set(headers).send({
        tenantId: 'tenant-b',
        jobId: '507f1f77bcf86cd799439011',
      }),
    ]);

    expect(responses.every((response) => response.status < 400)).toBe(true);
    expect(responses[0].body.jobs[0].tenantId).toBe('tenant-a');
    expect(responses[1].body.job.tenantId).toBe('tenant-a');
    expect(responses[2].body.matches[0].tenantId).toBe('tenant-a');
    expect(responses[3].body.matches[0].tenantId).toBe('tenant-a');
    expect(responses[4].body.tenantId).toBe('tenant-a');
    expect(responses[5].body.tenantId).toBe('tenant-a');
    expect(responses[6].body.jobs[0].tenantId).toBe('tenant-a');
    expect(services.queueBulkMatch).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a' }));
  });

  it('rejects requests without tenant context', async () => {
    const { default: app } = await import('../app.js');
    const response = await request(app).get('/api/jobs');
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain('x-tenant-id');
  });
});
