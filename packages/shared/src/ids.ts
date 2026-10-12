export const ID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function normalizeId(value: string): string {
  return value
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}
export function isValidId(value: string): boolean {
  return /^[0-9A-HJKMNP-TV-Z]{12}$/.test(normalizeId(value));
}
export function formatIdForDisplay(value: string): string {
  return (
    normalizeId(value)
      .match(/.{1,4}/g)
      ?.join(' ') ?? ''
  );
}

export type RandomBytes = (length: number) => Uint8Array;
export function generateId(randomBytes: RandomBytes): string {
  const bytes = randomBytes(12);
  if (bytes.length !== 12)
    throw new Error('Random source returned the wrong length');
  return Array.from(bytes, (byte) => ID_ALPHABET[byte & 31]).join('');
}
export function generateSecret(randomBytes: RandomBytes): string {
  return Array.from(randomBytes(16), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
