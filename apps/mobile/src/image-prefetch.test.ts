import { beforeEach, expect, it, vi } from 'vitest';
import { prefetchImages } from './image-prefetch';

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock('react-native', () => ({
  Image: { resolveAssetSource: mocks.resolve, prefetch: mocks.prefetch },
}));
beforeEach(() => {
  vi.resetAllMocks();
});

it('prefetches dev-server and bundle file sheets and skips resource names', async () => {
  const uris: Record<number, string> = {
    1: 'http://localhost:8081/assets/reaction-01.png',
    2: 'file:///app/bundle/reaction-02.png',
    3: 'assets_cerberus_reaction03',
  };
  mocks.resolve.mockImplementation((source: number) => ({ uri: uris[source] }));
  mocks.prefetch.mockResolvedValue(true);
  await prefetchImages([1, 2, 3]);
  expect(mocks.prefetch.mock.calls).toEqual([[uris[1]], [uris[2]]]);
});

it('never rejects when a sheet cannot be prefetched', async () => {
  mocks.resolve
    .mockImplementationOnce(() => {
      throw new Error('Unknown asset');
    })
    .mockReturnValue({ uri: 'file:///sheet.png' });
  mocks.prefetch.mockRejectedValue(new Error('Decode failed'));
  await expect(prefetchImages([1, 2])).resolves.toBeDefined();
});
