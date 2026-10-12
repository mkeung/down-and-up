export async function boundedFetch<T>(
  url: string,
  init: RequestInit,
  parent: AbortSignal,
  timeout: number,
  consume: (response: Response) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (parent.aborted) abort();
  else parent.addEventListener('abort', abort);
  const timer = setTimeout(abort, timeout);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return await consume(response);
  } finally {
    clearTimeout(timer);
    parent.removeEventListener('abort', abort);
  }
}
