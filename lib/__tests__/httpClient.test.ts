import { describe, it, expect, vi, beforeEach } from 'vitest';
import { postJson, deleteJson, HttpError } from '../httpClient';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeResponse(status: number, body: unknown, ok?: boolean) {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    json: () => Promise.resolve(body),
  };
}

describe('postJson', () => {
  beforeEach(() => mockFetch.mockReset());

  it('sends POST with JSON Content-Type and serialized body', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { result: 'ok' }));
    await postJson('/api/test', { key: 'value' });
    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'value' }),
    });
  });

  it('returns parsed JSON body on 200', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { data: 42 }));
    const result = await postJson<{ data: number }>('/api/test', {});
    expect(result).toEqual({ data: 42 });
  });

  it('throws HttpError with status and error message from response body', async () => {
    mockFetch.mockResolvedValue(makeResponse(500, { error: 'Server exploded' }));
    await expect(postJson('/api/test', {})).rejects.toMatchObject({
      name: 'HttpError',
      status: 500,
      message: 'Server exploded',
    });
  });

  it('throws HttpError with status 401 for auth failures', async () => {
    mockFetch.mockResolvedValue(makeResponse(401, { error: 'Unauthorized' }));
    await expect(postJson('/api/test', {})).rejects.toMatchObject({
      status: 401,
    });
  });

  it('throws HttpError with status 422 for validation failures', async () => {
    mockFetch.mockResolvedValue(makeResponse(422, {}));
    await expect(postJson('/api/test', {})).rejects.toMatchObject({
      status: 422,
      message: 'HTTP 422',
    });
  });

  it('falls back to "HTTP <status>" when error body has no error field', async () => {
    mockFetch.mockResolvedValue(makeResponse(503, {}));
    await expect(postJson('/api/test', {})).rejects.toMatchObject({
      status: 503,
      message: 'HTTP 503',
    });
  });

  it('falls back to "HTTP <status>" when error body is unparseable JSON', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new SyntaxError('bad json')),
    });
    await expect(postJson('/api/test', {})).rejects.toMatchObject({
      status: 502,
      message: 'HTTP 502',
    });
  });

  it('HttpError is instanceof Error', async () => {
    mockFetch.mockResolvedValue(makeResponse(400, { error: 'bad request' }));
    let caught: unknown;
    try {
      await postJson('/api/test', {});
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).toBeInstanceOf(HttpError);
  });
});

describe('deleteJson', () => {
  beforeEach(() => mockFetch.mockReset());

  it('sends DELETE with JSON Content-Type and no body', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { deletedAt: '2026-07-03T00:00:00Z' }));
    await deleteJson('/api/participant/self-delete');
    expect(mockFetch).toHaveBeenCalledWith('/api/participant/self-delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('returns parsed JSON body on 200', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { deletedAt: 'x' }));
    const result = await deleteJson<{ deletedAt: string }>('/api/test');
    expect(result).toEqual({ deletedAt: 'x' });
  });

  it('throws HttpError with error message from response body', async () => {
    mockFetch.mockResolvedValue(makeResponse(500, { error: 'delete failed' }));
    await expect(deleteJson('/api/test')).rejects.toMatchObject({
      name: 'HttpError',
      status: 500,
      message: 'delete failed',
    });
  });

  it('throws HttpError 401 when unauthenticated', async () => {
    mockFetch.mockResolvedValue(makeResponse(401, { error: 'Unauthorized' }));
    await expect(deleteJson('/api/test')).rejects.toMatchObject({ status: 401 });
  });

  it('falls back to "HTTP <status>" when error body is unparseable', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new SyntaxError('bad json')),
    });
    await expect(deleteJson('/api/test')).rejects.toMatchObject({
      status: 502,
      message: 'HTTP 502',
    });
  });
});
