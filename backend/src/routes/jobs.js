import { Router } from 'express';
import {
  createJob,
  getJobs,
  getJob,
  getJobMatches,
} from '../controllers/jobController.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.post('/', requireRole('recruiter'), createJob);
router.get('/', requireRole('candidate', 'recruiter'), getJobs);
router.get('/:id/matches', requireRole('recruiter'), getJobMatches);
router.get('/:id', getJob);

export default router;
