export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** localStorage key holding the optional shared access code (see lib/api-guard.ts). */
export const ACCESS_CODE_KEY = 'diet-tracker:access-code';

/** Read the optional shared access code (browser only; never throws). */
function readAccessCode(): string | null {
  try {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem(ACCESS_CODE_KEY)
      : null;
  } catch {
    return null;
  }
}

/**
 * Build request headers. The `x-access-code` header is attached only when a code
 * is stored, so default callers (and the unit tests) send just Content-Type.
 */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const code = readAccessCode();
  if (code) headers['x-access-code'] = code;
  return headers;
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'GET', headers: buildHeaders() });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch {}
    throw new HttpError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export async function deleteJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE', headers: buildHeaders() });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch {}
    throw new HttpError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export async function postJson<T>(url: string, body: unknown, _retried = false): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  // Optional access gate (APP_ACCESS_CODE on the server): on a 403, prompt once
  // for the shared code, persist it, and retry. No-op outside the browser and
  // when the user cancels — the 403 then surfaces as a normal HttpError below.
  if (
    res.status === 403 &&
    !_retried &&
    typeof window !== 'undefined' &&
    typeof window.prompt === 'function'
  ) {
    const code = window.prompt('このアプリのアクセスコードを入力してください');
    if (code) {
      try {
        localStorage.setItem(ACCESS_CODE_KEY, code);
      } catch {}
      return postJson<T>(url, body, true);
    }
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch {}
    throw new HttpError(res.status, message);
  }

  return res.json() as Promise<T>;
}
