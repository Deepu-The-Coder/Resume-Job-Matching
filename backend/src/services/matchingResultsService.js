import { Match } from '../models/Match.js';
import { explainMatch } from './explanationService.js';
import { recordRequest } from './usageTrackingService.js';
import { scoped } from '../lib/tenantScope.js';

function values(value) {
  return new Set((value || []).map((item) => item.toLowerCase()));
}

function skillsForMatch(resumeSkills, jobSkills) {
  const resume = values(resumeSkills);
  const job = values(jobSkills);
  return {
    matchedSkills: [...job].filter((skill) => resume.has(skill)).sort(),
    missingSkills: [...job].filter((skill) => !resume.has(skill)).sort(),
  };
}

function withoutEmbedding(document) {
  const value = typeof document.toObject === 'function' ? document.toObject() : { ...document };
  delete value.embedding;
  return value;
}

async function saveMatch({ tenantId, resumeId, jobId, similarityScore, explanation, explanationSource }) {
  const update = { $set: { similarityScore } };
  if (explanationSource) {
    update.$set.explanation = explanation;
    update.$set.explanationSource = explanationSource;
  }
  await scoped(Match.findOneAndUpdate(
    { resumeId, jobId },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ), tenantId);
}

export async function buildMatches({
  ranked,
  resume,
  job,
  tenantId,
  explain,
  explainTop,
  requestId,
  resumeFirst,
}) {
  const matches = [];
  const sources = [];
  let cacheLookupMs = 0;
  let llmCallMs = 0;
  for (const [index, candidate] of ranked.entries()) {
    const currentResume = resumeFirst ? resume : candidate;
    const currentJob = resumeFirst ? candidate : job;
    const score = candidate.similarityScore;
    const skills = skillsForMatch(currentResume.skills, currentJob.requiredSkills);
    const explanation = explain && index < explainTop
      ? await explainMatch({
        resume: currentResume,
        job: currentJob,
        similarityScore: score,
        tenantId,
        ...skills,
        requestId,
      })
      : null;
    if (explanation) {
      sources.push(explanation.source ?? 'llm');
      cacheLookupMs += explanation.timings?.cacheLookupMs ?? 0;
      llmCallMs += explanation.timings?.llmCallMs ?? 0;
    }
    await saveMatch({
      tenantId,
      resumeId: currentResume._id,
      jobId: currentJob._id,
      similarityScore: score,
      explanation: explanation?.text,
      explanationSource: explanation ? (explanation.source ?? 'llm') : null,
    });
    matches.push({
      ...withoutEmbedding(candidate),
      similarityScore: score,
      ...skills,
      ...(explanation ? { explanation: explanation.text, explanationSource: explanation.source ?? 'llm' } : {}),
    });
  }
  return { matches, sources, cacheLookupMs, llmCallMs };
}

export async function recordMatchingRequest({
  tenantId,
  requestId,
  querySummary,
  requestStartedAt,
  retrievalMs,
  sources,
  cacheLookupMs,
  llmCallMs,
}) {
  const timing = {
    retrievalMs,
    cacheLookupMs: Number(cacheLookupMs.toFixed(2)),
    llmCallMs: Number(llmCallMs.toFixed(2)),
  };
  await recordRequest({
    tenantId,
    requestId,
    querySummary,
    source: sources.length ? (new Set(sources).size === 1 ? sources[0] : 'mixed') : 'none',
    latencyMs: Number((performance.now() - requestStartedAt).toFixed(2)),
    ...timing,
  });
  return timing;
}
