import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { identitySchema, type Identity } from '@down-up/shared';
import { signingSecret } from './env';
export const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export function constantEqual(a: string, b: string): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);
  return first.length === second.length && timingSafeEqual(first, second);
}
export function signSession(
  sessionId: string,
  secret = signingSecret(),
): string {
  return `${sessionId}.${createHmac('sha256', secret).update(sessionId).digest('base64url')}`;
}
export function verifySession(
  cookie: string,
  secret = signingSecret(),
): string | null {
  if (!/^[0-9a-f]{64}\.[A-Za-z0-9_-]{43}$/.test(cookie)) return null;
  const sessionId = cookie.split('.')[0]!;
  return constantEqual(cookie, signSession(sessionId, secret))
    ? sessionId
    : null;
}
export function sealIdentity(identity: Identity): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    createHash('sha256').update(signingSecret()).digest(),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(identity)),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    'base64url',
  );
}
export function openIdentity(sealed: string): Identity {
  const bytes = Buffer.from(sealed, 'base64url');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    createHash('sha256').update(signingSecret()).digest(),
    bytes.subarray(0, 12),
  );
  decipher.setAuthTag(bytes.subarray(12, 28));
  return identitySchema.parse(
    JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString(),
    ),
  );
}
