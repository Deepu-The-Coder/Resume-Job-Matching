import { describe, expect, it } from 'vitest';
import { servedByMiddleware } from '../middleware/servedBy.js';

describe('served-by middleware', () => {
  it('sets the process hostname on every response', () => {
    const headers = {};
    servedByMiddleware({}, {
      setHeader(name, value) {
        headers[name] = value;
      },
    }, () => {});

    expect(headers['X-Served-By']).toBeTruthy();
  });
});
