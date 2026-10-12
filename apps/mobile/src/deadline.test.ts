import { afterEach, expect, it, vi } from 'vitest';
import { withDeadline } from './deadline';
afterEach(() => vi.useRealTimers());
it('releases a stalled native operation without leaving a deadline timer', async () => {
  vi.useFakeTimers();
  const operation = withDeadline(new Promise<never>(() => undefined), 15000);
  const assertion = expect(operation).rejects.toThrow('Audio is unavailable');
  await vi.advanceTimersByTimeAsync(15000);
  await assertion;
  expect(vi.getTimerCount()).toBe(0);
});
it('clears the deadline when the operation completes or rejects', async () => {
  vi.useFakeTimers();
  expect(await withDeadline(Promise.resolve(7), 15000)).toBe(7);
  await expect(
    withDeadline(Promise.reject(new Error('Unavailable')), 15000),
  ).rejects.toThrow('Unavailable');
  expect(vi.getTimerCount()).toBe(0);
});
