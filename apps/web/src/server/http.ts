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
export async function body<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
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
    const parsed = schema.safeParse(
      JSON.parse(Buffer.concat(chunks).toString('utf8')),
    );
    if (!parsed.success) throw new HttpError(400, 'Check the submitted data');
    return parsed.data;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Check the submitted data');
  }
}
