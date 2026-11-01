import { getStats } from '../services/usageTrackingService.js';
import { BadRequestError } from '../lib/errors.js';
import { parseInput } from '../middleware/validate.js';
import { statsQuerySchema } from '../schemas/apiSchemas.js';

export async function stats(req, res, next) {
  try {
    const { range } = parseInput(statsQuerySchema, req.query);
    const { tenantId } = req;
    if (!['24h', '7d'].includes(range)) throw new BadRequestError('range must be 24h or 7d');
    res.status(200).json(await getStats({ tenantId, range }));
  } catch (error) {
    next(error);
  }
}

export default { stats };
