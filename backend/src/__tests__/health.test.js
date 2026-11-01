import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';

describe('GET /health', () => {
  it('should return 200 with server status and database health diagnostic', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.headers['x-request-id']).toBeDefined();

    expect(res.body).toHaveProperty('status');
    expect(['ok', 'degraded']).toContain(res.body.status);
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptimeSeconds');
    expect(res.body).toHaveProperty('environment');
    expect(res.body).toHaveProperty('database');
    expect(res.body.database).toHaveProperty('readyState');
    expect(res.body.database).toHaveProperty('status');
    expect(res.body).toHaveProperty('redis');
    expect(res.body.redis).toHaveProperty('status');
    expect(res.body).toHaveProperty('llm');
    expect(['closed', 'open', 'half-open']).toContain(res.body.llm.breakerState);
    expect(res.body.llm).toHaveProperty('fallbacksServed');
  });

  it('should respect incoming X-Request-Id header', async () => {
    const customId = 'custom-request-id-12345';
    const res = await request(app)
      .get('/health')
      .set('x-request-id', customId);

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(customId);
  });

  it('should return 404 with structured error JSON for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('message');
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(res.body).toHaveProperty('requestId');
  });
});
