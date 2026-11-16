export interface SafeJsonResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  isHtmlFallback: boolean;
}

/**
 * Safely parses JSON from fetch responses without throwing SyntaxError when an
 * HTML fallback page (e.g. "<!doctype html>...") is returned during restarts or static hosting.
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeJsonResult<T>> {
  const res = await fetch(input, init);
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const rawText = await res.text();
  const trimmed = rawText.trimStart();

  const looksLikeHtml =
    contentType.includes('text/html') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<');

  if (looksLikeHtml) {
    return {
      ok: false,
      status: res.status,
      data: null,
      isHtmlFallback: true,
    };
  }

  if (!trimmed) {
    return {
      ok: res.ok,
      status: res.status,
      data: null,
      isHtmlFallback: false,
    };
  }

  try {
    const parsed = JSON.parse(rawText) as T;
    return {
      ok: res.ok,
      status: res.status,
      data: parsed,
      isHtmlFallback: false,
    };
  } catch {
    return {
      ok: false,
      status: res.status,
      data: null,
      isHtmlFallback: false,
    };
  }
}
