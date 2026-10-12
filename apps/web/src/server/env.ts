import 'server-only';
export function requiredEnv(key: string, alternative?: string): string {
  const value =
    process.env[key] || (alternative ? process.env[alternative] : undefined);
  if (!value) throw new Error('Server configuration is incomplete');
  return value;
}
export function appOrigin(): string {
  const configured =
    process.env.APP_ORIGIN ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  if (!configured) throw new Error('Server configuration is incomplete');
  const origin = new URL(configured);
  if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')
    throw new Error('HTTPS is required');
  return origin.origin;
}
export function signingSecret(): string {
  const value = requiredEnv('SESSION_SIGNING_SECRET');
  if (value.length < 32) throw new Error('Server configuration is incomplete');
  return value;
}
