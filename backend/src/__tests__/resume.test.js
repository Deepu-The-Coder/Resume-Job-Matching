import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';

// ─── Mock: embedding service (the defined seam per project rules) ─────────────
vi.mock('../services/embeddingService.js', () => ({
  embedText: vi.fn().mockResolvedValue(Array(1536).fill(0.01)),
  default: { embedText: vi.fn().mockResolvedValue(Array(1536).fill(0.01)) },
}));

// ─── Mock: Resume model (Mongoose DB calls) ───────────────────────────────────
vi.mock('../models/Resume.js', () => {
  const fakeId = new mongoose.Types.ObjectId().toString();

  const mockResume = {
    _id: fakeId,
    tenantId: 'tenant-001',
    userId: new mongoose.Types.ObjectId().toString(),
    originalFilename: 'test.pdf',
    parsedText: 'Some parsed resume text',
    contentHash: 'abc123hash',
    skills: ['javascript', 'react', 'node.js'],
    embeddingModel: 'text-embedding-3-small',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    Resume: {
      findOne: vi.fn(),
      create: vi.fn(),
    },
    default: {
      findOne: vi.fn(),
      create: vi.fn(),
    },
    _mockResume: mockResume,   // Exported for test access
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal but real-enough PDF buffer that pdf-parse can extract text from.
 * Uses standard PDF stream syntax so the parser produces non-empty output.
 */
function buildPdf(text) {
  const escaped = text.replace(/[()\\]/g, '\\$&');
  const stream = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
  const len = Buffer.byteLength(stream, 'utf-8');

  return Buffer.from(
    [
      '%PDF-1.4',
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
      '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Contents 4 0 R'
        + '/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj',
      `4 0 obj<</Length ${len}>>`,
      'stream',
      stream,
      'endstream endobj',
      'xref',
      '0 5',
      '0000000000 65535 f ',
      '0000000009 00000 n ',
      '0000000058 00000 n ',
      '0000000115 00000 n ',
      '0000000266 00000 n ',
      'trailer<</Size 5/Root 1 0 R>>',
      'startxref',
      '400',
      '%%EOF',
    ].join('\n'),
    'utf-8'
  );
}

// ─── Test setup ───────────────────────────────────────────────────────────────
const TENANT = 'tenant-001';
const USER = new mongoose.Types.ObjectId().toString();

let ResumeMock;
let mockResume;

beforeEach(async () => {
  vi.clearAllMocks();

  // Re-acquire the mocked module after clearing mocks
  const mod = await import('../models/Resume.js');
  ResumeMock = mod.Resume;
  mockResume = mod._mockResume;
});

// ─── POST /api/resumes ────────────────────────────────────────────────────────
describe('POST /api/resumes', () => {
  it('successfully uploads a PDF and returns a resume without the embedding field', async () => {
    ResumeMock.findOne.mockResolvedValue(null);   // No duplicate
    ResumeMock.create.mockResolvedValue(mockResume);

    const pdfBuffer = buildPdf(
      'John Doe Senior Software Engineer javascript react node.js mongodb docker kubernetes'
    );

    const res = await request(app)
      .post('/api/resumes')
      .set('x-tenant-id', TENANT)
      .field('userId', USER)
      .field('tenantId', TENANT)
      .attach('resume', pdfBuffer, { filename: 'john-doe.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('resume');
    expect(res.body.resume).toHaveProperty('_id');
    expect(res.body.resume).toHaveProperty('tenantId', TENANT);
    expect(res.body.resume).toHaveProperty('originalFilename');
    expect(res.body.resume).toHaveProperty('skills');
    expect(res.body.resume).toHaveProperty('contentHash');
    expect(res.body.resume).toHaveProperty('embeddingModel');
    // Embedding must NOT be in the response
    expect(res.body.resume.embedding).toBeUndefined();
    // Embedding service must have been called once
    const { embedText } = await import('../services/embeddingService.js');
    expect(embedText).toHaveBeenCalledTimes(1);
  });

  it('returns the cached resume without calling embeddings when same content is uploaded twice', async () => {
    // Simulate duplicate: findOne returns existing
    ResumeMock.findOne.mockResolvedValue(mockResume);

    const pdfBuffer = buildPdf(
      'Jane Smith Frontend Developer typescript vue react css html webpack'
    );

    const res = await request(app)
      .post('/api/resumes')
      .set('x-tenant-id', TENANT)
      .field('userId', USER)
      .field('tenantId', TENANT)
      .attach('resume', pdfBuffer, { filename: 'jane.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.resume._id).toBe(mockResume._id.toString());

    // create and embedText must NOT have been called — pure cache hit
    expect(ResumeMock.create).not.toHaveBeenCalled();
    const { embedText } = await import('../services/embeddingService.js');
    expect(embedText).not.toHaveBeenCalled();
  });

  it('rejects non-PDF files with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
    const res = await request(app)
      .post('/api/resumes')
      .set('x-tenant-id', TENANT)
      .field('userId', USER)
      .field('tenantId', TENANT)
      .attach('resume', Buffer.from('hello world'), {
        filename: 'resume.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects an empty (near-empty text) PDF with 422 PDF_EMPTY', async () => {
    // 'hi' is only 2 chars — well under the 20-char minimum
    const emptyPdf = buildPdf('hi');

    const res = await request(app)
      .post('/api/resumes')
      .set('x-tenant-id', TENANT)
      .field('userId', USER)
      .field('tenantId', TENANT)
      .attach('resume', emptyPdf, { filename: 'empty.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PDF_EMPTY');
  });

  it('rejects missing userId with 400 BAD_REQUEST', async () => {
    const pdfBuffer = buildPdf('Alice Brown DevOps engineer docker kubernetes aws terraform');

    const res = await request(app)
      .post('/api/resumes')
      .field('tenantId', TENANT)
      .attach('resume', pdfBuffer, { filename: 'alice.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects missing tenantId with 400 BAD_REQUEST', async () => {
    const pdfBuffer = buildPdf('Bob Lee backend engineer python django postgresql redis');

    const res = await request(app)
      .post('/api/resumes')
      .field('userId', USER)
      .attach('resume', pdfBuffer, { filename: 'bob.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects a missing file with 400 BAD_REQUEST', async () => {
    const res = await request(app)
      .post('/api/resumes')
      .field('userId', USER)
      .field('tenantId', TENANT);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});

// ─── GET /api/resumes/:id ─────────────────────────────────────────────────────
describe('GET /api/resumes/:id', () => {
  it('returns a resume by ID without the embedding field', async () => {
    // findOne returns a lean object (no .select chain) — simulate .select()
    const selectMock = vi.fn().mockResolvedValue(mockResume);
    ResumeMock.findOne.mockReturnValue({ select: selectMock });

    const res = await request(app)
      .get(`/api/resumes/${mockResume._id}`)
      .set('x-tenant-id', TENANT);

    expect(res.status).toBe(200);
    expect(res.body.resume._id).toBe(mockResume._id.toString());
    expect(res.body.resume.embedding).toBeUndefined();
    expect(res.body.resume).toHaveProperty('skills');
    // Confirm select was called with the exclusion flag
    expect(selectMock).toHaveBeenCalledWith('-embedding');
  });

  it('returns 404 when resume does not exist in the tenant', async () => {
    const selectMock = vi.fn().mockResolvedValue(null);
    ResumeMock.findOne.mockReturnValue({ select: selectMock });

    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/resumes/${fakeId}`)
      .set('x-tenant-id', TENANT);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for a malformed (non-ObjectId) resume ID', async () => {
    const res = await request(app)
      .get('/api/resumes/not-a-valid-id')
      .set('x-tenant-id', TENANT);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 when tenant context header is missing', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/resumes/${fakeId}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});
