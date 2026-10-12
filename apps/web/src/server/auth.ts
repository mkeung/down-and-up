import { cookies, headers } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';
import { idSchema } from '@down-up/shared';
import { getDb } from './db';
import { profiles, sessions } from './schema';
import { verifySession } from './security';
import { appOrigin } from './env';
import { HttpError } from './http';
import { failedLookup, rateLimit } from './rate-limit';
export const COOKIE_NAME = 'du_session';
export function assertOrigin(request: Request): void {
  const origins = new Set([appOrigin()]);
  if (process.env.VERCEL_ENV === 'preview') {
    if (process.env.VERCEL_URL)
      origins.add(`https://${process.env.VERCEL_URL}`);
    if (process.env.VERCEL_BRANCH_URL)
      origins.add(`https://${process.env.VERCEL_BRANCH_URL}`);
  }
  if (!origins.has(request.headers.get('origin') ?? ''))
    throw new HttpError(403, 'Request not allowed');
}
export function rawBearer(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  const result = idSchema.safeParse(authorization.slice(7));
  return result.success ? result.data : null;
}
export async function bearerId(request: Request): Promise<string> {
  const id = rawBearer(request);
  await rateLimit(request, id ?? undefined);
  if (!id) return failedLookup(request);
  return id;
}
export async function sessionProfile(
  alreadyRateLimited = false,
): Promise<string | null> {
  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  if (!cookie) return null;
  const session = verifySession(cookie);
  if (!session) return null;
  if (!alreadyRateLimited)
    await rateLimit(new Request(appOrigin(), { headers: await headers() }));
  try {
    const [row] = await getDb()
      .select({ profileId: sessions.profileId })
      .from(sessions)
      .innerJoin(profiles, eq(sessions.profileId, profiles.id))
      .where(and(eq(sessions.id, session), gt(sessions.expiresAt, new Date())))
      .limit(1);
    return row?.profileId ?? null;
  } catch {
    throw new Error('Could not check this session');
  }
}
export async function authenticate(
  request: Request,
  options: { sessionOnly?: boolean; bearerOnly?: boolean } = {},
): Promise<{ id: string; via: 'bearer' | 'cookie' }> {
  if (!options.sessionOnly && request.headers.has('authorization')) {
    const id = await bearerId(request);
    const [profile] = await getDb()
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);
    if (!profile) return failedLookup(request);
    return { id, via: 'bearer' };
  }
  if (options.bearerOnly) {
    await rateLimit(request);
    return failedLookup(request);
  }
  await rateLimit(request);
  if (!['GET', 'HEAD'].includes(request.method)) assertOrigin(request);
  const id = await sessionProfile(true);
  if (!id) throw new HttpError(401, 'Enter your ID');
  return { id, via: 'cookie' };
}
