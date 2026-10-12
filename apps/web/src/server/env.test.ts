import { afterEach, expect, it, vi } from 'vitest';
import { requiredEnv } from './env';
afterEach(() => vi.unstubAllEnvs());
it('accepts Vercel Marketplace Redis variables and prefers explicit SDK variables', () => {
  vi.stubEnv('UPSTASH_REDIS_REST_URL', undefined);
  vi.stubEnv('KV_REST_API_URL', 'https://staging.invalid');
  expect(requiredEnv('UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL')).toBe(
    'https://staging.invalid',
  );
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://explicit.invalid');
  expect(requiredEnv('UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL')).toBe(
    'https://explicit.invalid',
  );
  vi.stubEnv('UPSTASH_REDIS_REST_URL', undefined);
  vi.stubEnv('KV_REST_API_URL', undefined);
  expect(() =>
    requiredEnv('UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL'),
  ).toThrow('Server configuration is incomplete');
});
