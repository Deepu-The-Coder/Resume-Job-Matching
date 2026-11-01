import { config, matchRequest, summary } from './common.js';

export const options = {
  scenarios: {
    cold_matches: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 5),
      timeUnit: '1s',
      duration: __ENV.DURATION || '30s',
      preAllocatedVUs: 20,
      maxVUs: 60,
    },
  },
};

export default function () {
  const settings = config();
  matchRequest(settings, `cold-vu-${__VU}`);
}

export function handleSummary(data) {
  return summary(data);
}
