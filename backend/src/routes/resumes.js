import { Router } from 'express';
import { createResume, getResume, getResumeMatches } from '../controllers/resumeController.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// POST /api/resumes — upload a PDF resume
router.post('/', requireRole('candidate'), createResume);

// GET /api/resumes/:id — fetch a resume (embedding excluded)
router.get('/:id/matches', requireRole('candidate'), getResumeMatches);
router.get('/:id', requireRole('candidate'), getResume);

export default router;
