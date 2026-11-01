import { Router } from 'express';
import {
  bulkEmbed,
  bulkMatch,
  jobStatus,
  failedJobs,
} from '../controllers/adminController.js';

const router = Router();

router.post('/bulk-embed', bulkEmbed);
router.post('/bulk-match', bulkMatch);
router.get('/jobs/:jobId', jobStatus);
router.get('/failed-jobs', failedJobs);

export default router;
