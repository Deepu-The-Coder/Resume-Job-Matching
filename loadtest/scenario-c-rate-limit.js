import { config, matchRequest, summary } from './common.js';

export const options = {
  scenarios: {
    one_user_burst: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 30),
      timeUnit: '1s',
      duration: __ENV.DURATION || '10s',
      preAllocatedVUs: 20,
      maxVUs: 60,
    },
  },
};

export default function () {
  const settings = config();
  matchRequest(settings, 'rate-limit-burst-user');
}

export function handleSummary(data) {
  return summary(data);
}
