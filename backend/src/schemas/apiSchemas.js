import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'must be a MongoDB ObjectId');
const password = z.string().min(8).max(128);
const tenant = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}$/);
export const authRegisterSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().max(254),
  password,
  role: z.enum(['candidate', 'recruiter']),
  tenantId: tenant,
}).strict();
export const authLoginSchema = z.object({
  email: z.string().email().max(254),
  password,
  tenantId: tenant,
}).strict();
export const resumeBodySchema = z.object({
  userId: objectId.optional(),
}).passthrough();

export const jobBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(20000),
  requiredSkills: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  postedBy: objectId.optional(),
}).strict();

export const tenantQuerySchema = z.object({
  k: z.coerce.number().int().positive().optional(),
  explain: z.enum(['true', 'false']).optional(),
  explainTop: z.coerce.number().int().positive().optional(),
}).passthrough();

export const statsQuerySchema = z.object({
  range: z.enum(['24h', '7d']).default('24h'),
}).passthrough();

export const bulkEmbedSchema = z.object({
  type: z.enum(['resume', 'job']),
  ids: z.array(objectId).min(1).max(1000),
}).passthrough();

export const bulkMatchSchema = z.object({
  jobId: objectId,
  k: z.coerce.number().int().positive().optional(),
}).passthrough();

export const idParamsSchema = z.object({ id: objectId });
export const queueJobParamsSchema = z.object({ jobId: z.string().min(1).max(100) });
