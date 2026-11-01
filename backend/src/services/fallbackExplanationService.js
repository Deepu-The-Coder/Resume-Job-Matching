function listSkills(skills) {
  return skills.length ? skills.join(', ') : 'none identified';
}

/**
 * Builds an explanation without making an AI call.
 *
 * @param {{ matchedSkills?: string[], missingSkills?: string[], similarityScore: number }} input
 * @returns {string}
 */
export function buildFallbackExplanation({
  matchedSkills = [],
  missingSkills = [],
  similarityScore,
}) {
  const score = Number.isFinite(Number(similarityScore))
    ? Number(similarityScore).toFixed(2)
    : 'unknown';
  return `Strong match on: ${listSkills(matchedSkills)}. Missing: ${listSkills(missingSkills)}. Similarity score: ${score}.`;
}

export default { buildFallbackExplanation };
