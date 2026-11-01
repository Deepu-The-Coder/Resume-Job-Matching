import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { User, Resume, Job, Match } from '../models/index.js';

describe('Mongoose Models Schema & Multi-Tenancy Validation', () => {
  describe('User Model', () => {
    it('should validate valid user and fail if required fields are missing', () => {
      const emptyUser = new User({});
      const err = emptyUser.validateSync();
      expect(err.errors.name).toBeDefined();
      expect(err.errors.email).toBeDefined();
      expect(err.errors.role).toBeDefined();
      expect(err.errors.tenantId).toBeDefined();
    });

    it('should enforce role enum values', () => {
      const invalidUser = new User({
        name: 'John',
        email: 'john@example.com',
        passwordHash: 'salt:hash',
        role: 'admin', // invalid enum
        tenantId: 'tenant-1',
      });
      const err = invalidUser.validateSync();
      expect(err.errors.role).toBeDefined();
    });

    it('should pass validation for valid candidate and recruiter', () => {
      const validUser = new User({
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'candidate',
        passwordHash: 'salt:hash',
        tenantId: 'tenant-1',
      });
      const err = validUser.validateSync();
      expect(err).toBeUndefined();
    });
  });

  describe('Resume Model', () => {
    it('should require tenantId, userId, originalFilename, parsedText, contentHash, embeddingModel', () => {
      const emptyResume = new Resume({});
      const err = emptyResume.validateSync();
      expect(err.errors.tenantId).toBeDefined();
      expect(err.errors.userId).toBeDefined();
      expect(err.errors.originalFilename).toBeDefined();
      expect(err.errors.parsedText).toBeDefined();
      expect(err.errors.contentHash).toBeDefined();
      expect(err.errors.embeddingModel).toBeDefined();
    });

    it('should pass validation with valid fields', () => {
      const validResume = new Resume({
        userId: new mongoose.Types.ObjectId(),
        tenantId: 'tenant-1',
        originalFilename: 'resume.pdf',
        parsedText: 'Experienced Node.js developer...',
        contentHash: 'hash-abc-123',
        skills: ['Node.js', 'React'],
        embedding: [0.123, -0.456, 0.789],
        embeddingModel: 'text-embedding-3-small',
      });
      const err = validResume.validateSync();
      expect(err).toBeUndefined();
    });
  });

  describe('Job Model', () => {
    it('should require tenantId, title, description, contentHash, embeddingModel, postedBy', () => {
      const emptyJob = new Job({});
      const err = emptyJob.validateSync();
      expect(err.errors.tenantId).toBeDefined();
      expect(err.errors.title).toBeDefined();
      expect(err.errors.description).toBeDefined();
      expect(err.errors.contentHash).toBeDefined();
      expect(err.errors.embeddingModel).toBeDefined();
      expect(err.errors.postedBy).toBeDefined();
    });

    it('should pass validation with valid job attributes', () => {
      const validJob = new Job({
        tenantId: 'tenant-1',
        title: 'Backend Engineer',
        description: 'Building microservices in Node and MongoDB',
        requiredSkills: ['Node.js', 'MongoDB', 'Redis'],
        contentHash: 'job-hash-456',
        embedding: [0.01, 0.02, 0.03],
        embeddingModel: 'text-embedding-3-small',
        postedBy: new mongoose.Types.ObjectId(),
      });
      const err = validJob.validateSync();
      expect(err).toBeUndefined();
    });
  });

  describe('Match Model', () => {
    it('should require tenantId, resumeId, jobId, similarityScore', () => {
      const emptyMatch = new Match({});
      const err = emptyMatch.validateSync();
      expect(err.errors.tenantId).toBeDefined();
      expect(err.errors.resumeId).toBeDefined();
      expect(err.errors.jobId).toBeDefined();
      expect(err.errors.similarityScore).toBeDefined();
    });

    it('should reject similarityScore outside [0, 1]', () => {
      const invalidScoreMatch = new Match({
        tenantId: 'tenant-1',
        resumeId: new mongoose.Types.ObjectId(),
        jobId: new mongoose.Types.ObjectId(),
        similarityScore: 1.5,
      });
      const err = invalidScoreMatch.validateSync();
      expect(err.errors.similarityScore).toBeDefined();
    });

    it('should accept valid match with optional explanation and source', () => {
      const validMatch = new Match({
        tenantId: 'tenant-1',
        resumeId: new mongoose.Types.ObjectId(),
        jobId: new mongoose.Types.ObjectId(),
        similarityScore: 0.88,
        explanation: 'Strong skill overlap in Node.js and MongoDB.',
        explanationSource: 'llm',
      });
      const err = validMatch.validateSync();
      expect(err).toBeUndefined();
    });
  });
});
