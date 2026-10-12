import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import {
  MAX_AUDIO_BYTES,
  signedUrlSchema,
  uploadResponseSchema,
  type Identity,
} from '@down-up/shared';
import { ApiError, type Transport } from './sync-engine';
import type { AudioFile, Repository } from './repository';
import { boundedFetch } from './bounded-fetch';

export function apiUrl(): string | null {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (!configured) return null;
  const parsed = new URL(configured);
  if (parsed.protocol !== 'https:' && !(__DEV__ && parsed.protocol === 'http:'))
    throw new Error('The server must use HTTPS');
  return parsed.origin;
}
export class HttpTransport implements Transport {
  constructor(private readonly repo: Repository) {}
  async request(
    path: string,
    identity: Identity,
    method: string,
    body: unknown,
    signal: AbortSignal,
  ): Promise<unknown> {
    const base = apiUrl();
    if (!base) throw new Error('Server is not configured');
    if (signal.aborted) throw new Error('Sync stopped');
    return boundedFetch(
      base + path,
      {
        method,
        signal,
        headers: {
          Authorization: `Bearer ${identity.id}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
      signal,
      30_000,
      async (response) => {
        if (!response.ok) throw new ApiError(response.status);
        return response.status === 204 ? null : response.json();
      },
    );
  }
  async upload(
    file: AudioFile,
    identity: Identity,
    signal: AbortSignal,
  ): Promise<void> {
    if (!file.local_path) return;
    const data = new File(file.local_path);
    if (!data.exists || data.size < 1 || data.size > MAX_AUDIO_BYTES)
      throw new Error('Recording is unavailable');
    const grant = uploadResponseSchema.parse(
      await this.request(
        '/api/audio/upload-url',
        identity,
        'POST',
        { audioId: file.audio_id, size: data.size },
        signal,
      ),
    );
    if ('uploaded' in grant) return;
    const { url, headers } = grant;
    const bytes = await data.arrayBuffer();
    if (signal.aborted) throw new Error('Sync stopped');
    await boundedFetch(
      url,
      {
        method: 'PUT',
        signal,
        headers: {
          ...headers,
          'Content-Type': 'audio/mp4',
          'Content-Length': data.size.toString(),
        },
        body: bytes,
      },
      signal,
      120_000,
      async (response) => {
        if (!response.ok) throw new Error('Recording upload failed');
      },
    );
  }
  async download(
    audioId: string,
    identity: Identity,
    signal: AbortSignal,
  ): Promise<string> {
    const cached = await this.repo.audio(audioId);
    if (cached?.local_path && new File(cached.local_path).exists)
      return cached.local_path;
    const { url } = signedUrlSchema.parse(
      await this.request(
        `/api/audio/${audioId}`,
        identity,
        'GET',
        undefined,
        signal,
      ),
    );
    const directory = `${FileSystem.documentDirectory}recordings/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const path = `${directory}${audioId}.m4a`;
    const task = FileSystem.createDownloadResumable(url, path);
    const cancel = () => {
      void task.pauseAsync().catch(() => undefined);
    };
    signal.addEventListener('abort', cancel);
    const timer = setTimeout(cancel, 120_000);
    try {
      if (signal.aborted) throw new Error('Sync stopped');
      const result = await task.downloadAsync();
      if (!result || result.status !== 200 || signal.aborted)
        throw new Error('Recording download failed');
      const file = new File(result.uri);
      if (file.size > MAX_AUDIO_BYTES) {
        file.delete();
        throw new Error('Recording is too large');
      }
      await this.repo.cacheAudio(audioId, result.uri);
      return result.uri;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', cancel);
    }
  }
  async cleanup(includePending = false): Promise<void> {
    for (const file of await this.repo.collectAudio(includePending)) {
      if (file.local_path)
        await FileSystem.deleteAsync(file.local_path, { idempotent: true });
      await this.repo.forgetAudio(file.audio_id);
    }
  }
}
