import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import {
  generateId,
  generateSecret,
  identitySchema,
  type Identity,
} from '@down-up/shared';
const KEY = 'down-up.identity.v1';
export function newIdentity(): Identity {
  return {
    id: generateId(Crypto.getRandomBytes),
    secret: generateSecret(Crypto.getRandomBytes),
    registered: false,
  };
}
export async function readIdentity(): Promise<Identity | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return identitySchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
export async function writeIdentity(identity: Identity | null): Promise<void> {
  if (identity)
    await SecureStore.setItemAsync(KEY, JSON.stringify(identity), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  else await SecureStore.deleteItemAsync(KEY);
}
