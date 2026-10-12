import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { hash } from './security';
import { HttpError } from './http';
import { requiredEnv } from './env';
let cached: {
  redis: Redis;
  ip: Ratelimit;
  global: Ratelimit;
  profile: Ratelimit;
} | null = null;
function limits() {
  if (!cached) {
    const redis = new Redis({
      url: requiredEnv('UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL'),
      token: requiredEnv('UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN'),
      signal: () => AbortSignal.timeout(5000),
    });
    cached = {
      redis,
      ip: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(120, '1 m'),
        prefix: 'du:ip',
        analytics: false,
        timeout: 0,
      }),
      global: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20_000, '1 m'),
        prefix: 'du:global',
        analytics: false,
        timeout: 0,
      }),
      profile: new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(120, '1 m'),
        prefix: 'du:profile',
        analytics: false,
        timeout: 0,
      }),
    };
  }
  return cached;
}
function failureKeys(request: Request): [string, string] {
  // Vercel overwrites this header; do not accept caller-supplied forwarded IPs on another host.
  const ip = process.env.VERCEL
    ? (request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown')
    : 'local';
  const minute = Math.floor(Date.now() / 60_000);
  return [`du:failed:${hash(ip)}`, `du:failed:global:${minute}`];
}
export async function rateLimit(request: Request, id?: string): Promise<void> {
  const service = limits();
  const [ipKey, globalKey] = failureKeys(request);
  // One concurrent round trip: the limiters already ran in parallel with each
  // other, so reading the failure counters alongside them changes no outcome.
  // Failure blocks are still checked first.
  const [[ipFailures, globalFailures], ...results] = await Promise.all([
    service.redis.mget<(number | null)[]>(ipKey, globalKey),
    service.ip.limit(ipKey),
    service.global.limit('all'),
    ...(id ? [service.profile.limit(hash(id))] : []),
  ]);
  if ((ipFailures ?? 0) >= 10)
    throw new HttpError(429, 'Please wait and try again');
  if ((globalFailures ?? 0) >= 1000) {
    await service.redis.set('du:security:lookup-alert', Date.now(), {
      ex: 300,
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    throw new HttpError(429, 'Please wait and try again');
  }
  if (results.some((result) => result.reason === 'timeout'))
    throw new HttpError(503, 'Please try again');
  if (results.some((result) => !result.success))
    throw new HttpError(429, 'Please wait and try again');
}
export async function failedLookup(
  request: Request,
  status = 401,
  message = 'ID not found',
): Promise<never> {
  const [ipKey, globalKey] = failureKeys(request);
  const service = limits();
  await service.redis.eval(
    `local n=redis.call('INCR',KEYS[1]); redis.call('EXPIRE',KEYS[1], math.min(300,60*math.max(1,math.floor(n/10)))); local g=redis.call('INCR',KEYS[2]); if g==1 then redis.call('EXPIRE',KEYS[2],120) end; return n`,
    [ipKey, globalKey],
    [],
  );
  await new Promise((resolve) => setTimeout(resolve, 200));
  throw new HttpError(status, message);
}
