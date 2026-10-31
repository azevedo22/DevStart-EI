import { retryAfterMs } from './openai-compatible.client';

describe('retryAfterMs (quanto esperar depois de um 429)', () => {
  it.each([
    [
      'Rate limit reached for model `openai/gpt-oss-20b` ... on tokens per minute (TPM): Limit 8000, Used 7055, Requested 2374. Please try again in 10.7175s. Need more tokens?',
      10_718,
    ],
    ['Please try again in 1m2.5s.', 62_500],
    ['Please try again in 450ms.', 450],
    ['Please try again in 2m.', 120_000],
    [
      'You exceeded your current quota, please check your plan and billing details.',
      null,
    ],
    ['', null],
  ])('%s → %s', (detail, ms) => {
    expect(retryAfterMs(detail)).toBe(ms);
  });
});
