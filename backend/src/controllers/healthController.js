import { getHealthStatus } from '../services/healthService.js';

/**
 * Controller handling health check requests.
 */
export async function getHealth(req, res) {
  const health = await getHealthStatus();
  res.status(200).json(health);
}

export default {
  getHealth,
};
