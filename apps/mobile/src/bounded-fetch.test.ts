import { afterEach, expect, it, vi } from 'vitest';
import { boundedFetch } from './bounded-fetch';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stalledBody() {
  let consuming!: () => void;
  const started = new Promise<void>((resolve) => {
    consuming = resolve;
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => ({
      json: () =>
        new Promise((_, reject) => {
          init.signal!.addEventListener('abort', () =>
            reject(new Error('Aborted')),
          );
          consuming();
        }),
    })),
  );
  return started;
}

it('keeps sync cancellation active while reading the response body', async () => {
  const started = stalledBody();
  const parent = new AbortController();
  const request = boundedFetch(
    'https://example.invalid',
    {},
    parent.signal,
    30000,
    (response) => response.json(),
  );
  const assertion = expect(request).rejects.toThrow('Aborted');
  await started;
  parent.abort();
  await assertion;
});

it('times out a stalled response body after headers have arrived', async () => {
  vi.useFakeTimers();
  const started = stalledBody();
  const request = boundedFetch(
    'https://example.invalid',
    {},
    new AbortController().signal,
    30000,
    (response) => response.json(),
  );
  const assertion = expect(request).rejects.toThrow('Aborted');
  await started;
  await vi.advanceTimersByTimeAsync(30000);
  await assertion;
});

it('clears its timeout and handles an already cancelled parent', async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      if (init.signal!.aborted) throw new Error('Aborted');
      return new Response('{}');
    }),
  );
  const parent = new AbortController();
  expect(
    await boundedFetch(
      'https://example.invalid',
      {},
      parent.signal,
      30000,
      (response) => response.json(),
    ),
  ).toEqual({});
  expect(vi.getTimerCount()).toBe(0);
  parent.abort();
  await expect(
    boundedFetch(
      'https://example.invalid',
      {},
      parent.signal,
      30000,
      (response) => response.json(),
    ),
  ).rejects.toThrow('Aborted');
  expect(vi.getTimerCount()).toBe(0);
});
