import { Image, type ImageSourcePropType } from 'react-native';

// Warms the image loader for bundled sprite sheets so the first reaction does
// not wait on a load. Only URI sources (the dev server, or bundle files on
// iOS) can be prefetched; Android resource names already load from the APK.
export function prefetchImages(sources: readonly ImageSourcePropType[]) {
  return Promise.all(
    sources.map(async (source) => {
      try {
        const uri = Image.resolveAssetSource(source)?.uri;
        if (uri && /^(https?|file):/.test(uri)) await Image.prefetch(uri);
      } catch {
        /* Prefetching is an optimization; the sheet still loads on demand. */
      }
    }),
  );
}
