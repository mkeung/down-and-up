import type { z } from 'zod';
import { NextResponse } from 'next/server';
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message = 'Could not complete the request',
  ) {
    super(message);
  }
}
// The profile row was missing under the profile lock. Handlers that defer the
// authentication lookup to that lock report it as a failed lookup.
export class UnknownProfile extends HttpError {
  constructor() {
    super(401, 'ID not found');
  }
}
export const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
export function route(handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch (error) {
      return json(
        {
          error:
            error instanceof HttpError
              ? error.message
              : 'Could not complete the request',
        },
        error instanceof HttpError ? error.status : 503,
      );
    }
  };
}
// Reads the raw JSON body (size-capped) so it can overlap with authentication.
export async function readBody(request: Request): Promise<Buffer> {
  if (
    !(request.headers.get('content-type') ?? '').startsWith('application/json')
  )
    throw new HttpError(415);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new HttpError(413);
      }
      chunks.push(result.value);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Check the submitted data');
  }
}
export function parseBody<T>(raw: Buffer, schema: z.ZodType<T>): T {
  try {
    const parsed = schema.safeParse(JSON.parse(raw.toString('utf8')));
    if (parsed.success) return parsed.data;
  } catch {
    /* invalid JSON */
  }
  throw new HttpError(400, 'Check the submitted data');
}
export async function body<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  return parseBody(await readBody(request), schema);
}
