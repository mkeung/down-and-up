import { describe, expect, it } from 'vitest';
import { audioKey, uploadUrl } from './audio';
import {
  hash,
  openIdentity,
  sealIdentity,
  signSession,
  verifySession,
} from './security';
describe('credentials and storage', () => {
  it('uses one storage key for every UUID casing', () => {
    const audioId = 'B68D4F5E-4168-4D8B-AE7E-3C4DF743364C';
    expect(audioKey('7K3M9QX2PDA4', audioId)).toBe(
      audioKey('7K3M9QX2PDA4', audioId.toLowerCase()),
    );
  });
  it('signs opaque session IDs and rejects tampering', () => {
    const sessionId = 'a'.repeat(64);
    const cookie = signSession(sessionId, 'test-secret');
    expect(verifySession(cookie, 'test-secret')).toBe(sessionId);
    expect(
      verifySession(
        cookie.slice(0, -1) + (cookie.endsWith('b') ? 'c' : 'b'),
        'test-secret',
      ),
    ).toBeNull();
    expect(verifySession('7K3M9QX2PDA4', 'test-secret')).toBeNull();
  });
  it('encrypts retry receipts without exposing the new ID or secret', () => {
    process.env.SESSION_SIGNING_SECRET =
      'a-safe-test-secret-with-at-least-32-characters';
    const identity = {
      id: '7K3M9QX2PDA4',
      secret: 'a'.repeat(32),
      registered: true,
    };
    const receipt = sealIdentity(identity);
    expect(receipt).not.toContain(identity.id);
    expect(openIdentity(receipt)).toEqual(identity);
  });
  it('does not include the bearer ID in audio paths or signed URLs and signs size/type', async () => {
    process.env.R2_ENDPOINT = 'https://example.invalid';
    process.env.R2_ACCESS_KEY_ID = 'test';
    process.env.R2_SECRET_ACCESS_KEY = 'test';
    process.env.R2_BUCKET = 'test';
    const key = audioKey(
      '7K3M9QX2PDA4',
      'b68d4f5e-4168-4d8b-ae7e-3c4df743364c',
    );
    expect(key).toContain(hash('7K3M9QX2PDA4'));
    expect(key).not.toContain('7K3M9QX2PDA4');
    const { url } = await uploadUrl(key, 1024);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('X-Amz-SignedHeaders')?.split(';')).toEqual(
      expect.arrayContaining([
        'content-length',
        'content-type',
        'if-none-match',
      ]),
    );
    expect(url).not.toContain('7K3M9QX2PDA4');
  });
});
