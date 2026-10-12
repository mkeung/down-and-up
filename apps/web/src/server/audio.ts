import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MAX_AUDIO_BYTES } from '@down-up/shared';
import { requiredEnv } from './env';
import { hash } from './security';
let client: S3Client | null = null;
export function storage() {
  return (client ??= new S3Client({
    region: 'auto',
    endpoint: requiredEnv('R2_ENDPOINT'),
    credentials: {
      accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY'),
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  }));
}
export function audioKey(profileId: string, audioId: string): string {
  return namespaceKey(hash(profileId), audioId);
}
export function namespaceKey(namespace: string, audioId: string): string {
  return `audio/${namespace}/${audioId.toLowerCase()}.m4a`;
}
export async function audioHead(
  key: string,
): Promise<{ size: number; type: string } | null> {
  try {
    const response = await storage().send(
      new HeadObjectCommand({ Bucket: requiredEnv('R2_BUCKET'), Key: key }),
    );
    return {
      size: response.ContentLength ?? 0,
      type: response.ContentType ?? '',
    };
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      '$metadata' in error &&
      (error.$metadata as { httpStatusCode?: number }).httpStatusCode === 404
    )
      return null;
    throw error;
  }
}
export function validAudio(
  head: { size: number; type: string } | null,
): boolean {
  return (
    !!head &&
    head.size > 0 &&
    head.size <= MAX_AUDIO_BYTES &&
    head.type === 'audio/mp4'
  );
}
export async function uploadUrl(key: string, size: number) {
  const headers = {
    'Content-Type': 'audio/mp4',
    'Content-Length': size.toString(),
    'If-None-Match': '*',
  };
  const url = await getSignedUrl(
    storage(),
    new PutObjectCommand({
      Bucket: requiredEnv('R2_BUCKET'),
      Key: key,
      ContentLength: size,
      ContentType: 'audio/mp4',
      IfNoneMatch: '*',
    }),
    {
      expiresIn: 600,
      signableHeaders: new Set([
        'content-type',
        'content-length',
        'if-none-match',
      ]),
    },
  );
  return { url, headers };
}
export function downloadUrl(key: string) {
  return getSignedUrl(
    storage(),
    new GetObjectCommand({
      Bucket: requiredEnv('R2_BUCKET'),
      Key: key,
      ResponseContentType: 'audio/mp4',
    }),
    { expiresIn: 600 },
  );
}
export async function deleteObject(key: string) {
  await storage().send(
    new DeleteObjectCommand({ Bucket: requiredEnv('R2_BUCKET'), Key: key }),
  );
}
export async function copyAudio(oldKey: string, newKey: string) {
  await storage().send(
    new CopyObjectCommand({
      Bucket: requiredEnv('R2_BUCKET'),
      Key: newKey,
      CopySource: `${requiredEnv('R2_BUCKET')}/${oldKey}`,
    }),
  );
}
export function listObjects(token?: string, prefix = 'audio/') {
  return storage().send(
    new ListObjectsV2Command({
      Bucket: requiredEnv('R2_BUCKET'),
      Prefix: prefix,
      ContinuationToken: token,
      MaxKeys: 500,
    }),
  );
}
