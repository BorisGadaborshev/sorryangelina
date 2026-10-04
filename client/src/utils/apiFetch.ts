const DEFAULT_TIMEOUT_MS = 15000;

export async function apiFetch(input: RequestInfo | URL, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: outerSignal, ...rest } = init;
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onOuterAbort = () => controller.abort();
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort();
    else outerSignal.addEventListener('abort', onOuterAbort);
  }

  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new Error('Превышено время ожидания');
    }
    if (outerSignal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    outerSignal?.removeEventListener('abort', onOuterAbort);
  }
}
