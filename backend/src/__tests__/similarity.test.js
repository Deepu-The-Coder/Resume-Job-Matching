import { describe, expect, it } from 'vitest';
import { cosineSimilarity, rankTopK } from '../services/similarityService.js';

describe('cosineSimilarity', () => {
  it('returns one for identical non-zero vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('returns zero for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it('returns zero for zero vectors and length mismatches', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1], [1, 2])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('returns candidates sorted and limited by score', () => {
    const ranked = rankTopK([1, 0], [
      { id: 'low', embedding: [0, 1] },
      { id: 'high', embedding: [1, 0] },
      { id: 'middle', embedding: [1, 1] },
    ], 2);

    expect(ranked.map((candidate) => candidate.id)).toEqual(['high', 'middle']);
    expect(ranked[0].similarityScore).toBe(1);
  });
});
