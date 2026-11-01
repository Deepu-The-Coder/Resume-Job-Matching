/**
 * Calculate cosine similarity for two numeric vectors.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dotProduct += a[index] * b[index];
    magnitudeA += a[index] ** 2;
    magnitudeB += b[index] ** 2;
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

/**
 * Rank candidates by similarity to a query vector.
 *
 * @param {number[]} queryEmbedding
 * @param {Array<{ embedding: number[] }>} candidates
 * @param {number} k
 * @returns {Array<object>}
 */
export function rankTopK(queryEmbedding, candidates, k) {
  const limit = Number.isInteger(k) && k > 0 ? k : candidates.length;

  return candidates
    .map((candidate, index) => ({
      ...candidate,
      similarityScore: cosineSimilarity(queryEmbedding, candidate.embedding),
      _rankIndex: index,
    }))
    .sort((left, right) => (
      right.similarityScore - left.similarityScore || left._rankIndex - right._rankIndex
    ))
    .slice(0, limit)
    .map(({ _rankIndex, ...candidate }) => candidate);
}

export default { cosineSimilarity, rankTopK };
