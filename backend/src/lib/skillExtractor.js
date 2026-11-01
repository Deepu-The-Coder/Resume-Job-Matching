import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load skills list once at module init
const SKILLS_PATH = path.join(__dirname, '../data/skills.json');

let _skills = null;

async function getSkillsList() {
  if (!_skills) {
    const raw = await readFile(SKILLS_PATH, 'utf-8');
    _skills = JSON.parse(raw).map((s) => s.toLowerCase());
  }
  return _skills;
}

/**
 * Extract skills from text using a keyword match against the skills dictionary.
 * Case-insensitive, whole-word boundary matching.
 *
 * @param {string} text - Parsed resume or job description text
 * @returns {Promise<string[]>} Sorted, deduplicated array of matched skill names
 */
export async function extractSkills(text) {
  const skills = await getSkillsList();
  const lowerText = text.toLowerCase();
  const matched = new Set();

  for (const skill of skills) {
    // Escape special regex chars in skill name (e.g. "c++", "ci/cd")
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match whole-word boundaries; for multi-word skills, boundary on first/last word
    const pattern = new RegExp(`(?<![a-z0-9.])${escaped}(?![a-z0-9.])`, 'i');
    if (pattern.test(lowerText)) {
      matched.add(skill);
    }
  }

  return Array.from(matched).sort();
}

export default { extractSkills };
