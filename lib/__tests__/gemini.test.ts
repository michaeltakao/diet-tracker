import { describe, it, expect, vi } from 'vitest';
import { Type } from '@google/genai';
import {
  withRetry, jsonConfig, parseGeminiJson, GeminiParseError,
  isQuotaError, aiQuotaResponse, AI_QUOTA_MESSAGE,
} from '../gemini';

const transient = (status: number, msg = 'UNAVAILABLE') =>
  Object.assign(new Error(msg), { status });

describe('withRetry', () => {
  it('returns the first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    expect(await withRetry(fn, { baseMs: 0 })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a transient (503) error then succeeds', async () => {
    const fn = vi.fn().mockRejectedValueOnce(transient(503)).mockResolvedValue('ok');
    expect(await withRetry(fn, { baseMs: 0 })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-transient (400) error', async () => {
    const err = transient(400, 'bad request');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { baseMs: 0 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws the last error after exhausting attempts', async () => {
    const err = transient(503, 'overloaded');
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { attempts: 3, baseMs: 0 })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('detects transient errors by message when status is absent', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('The model is experiencing high demand'))
      .mockResolvedValue('ok');
    expect(await withRetry(fn, { baseMs: 0 })).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('parseGeminiJson', () => {
  it('parses bare JSON', () => {
    expect(parseGeminiJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it('strips markdown code fences', () => {
    expect(parseGeminiJson<{ a: number }>('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(parseGeminiJson<{ a: number }>('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('throws GeminiParseError on surrounding prose', () => {
    expect(() => parseGeminiJson('Here is the JSON: {"a": 1}')).toThrow(GeminiParseError);
  });

  it('throws GeminiParseError on undefined/empty input', () => {
    expect(() => parseGeminiJson(undefined)).toThrow(GeminiParseError);
    expect(() => parseGeminiJson('   ')).toThrow(GeminiParseError);
  });

  it('throws GeminiParseError on truncated JSON', () => {
    expect(() => parseGeminiJson('{"a": 1, "b": ')).toThrow(GeminiParseError);
  });
});

describe('jsonConfig', () => {
  it('returns a structured-output config wrapping the schema', () => {
    const schema = { type: Type.OBJECT, properties: { a: { type: Type.NUMBER } } };
    expect(jsonConfig(schema)).toEqual({
      responseMimeType: 'application/json',
      responseSchema: schema,
    });
  });
});

describe('quota errors (free-tier limit reached)', () => {
  it('recognises a 429 by status and by message', () => {
    expect(isQuotaError(Object.assign(new Error('x'), { status: 429 }))).toBe(true);
    expect(isQuotaError(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'))).toBe(true);
  });

  it('does not treat overload or bad requests as quota errors', () => {
    expect(isQuotaError(Object.assign(new Error('UNAVAILABLE'), { status: 503 }))).toBe(false);
    expect(isQuotaError(Object.assign(new Error('bad request'), { status: 400 }))).toBe(false);
    expect(isQuotaError(new GeminiParseError('not json'))).toBe(false);
  });

  it('answers a quota error with 429 and the user-facing message', async () => {
    const res = aiQuotaResponse(Object.assign(new Error('quota'), { status: 429 }));
    expect(res?.status).toBe(429);
    expect(res?.headers.get('Retry-After')).toBeNull();
    expect(await res?.json()).toEqual({ error: AI_QUOTA_MESSAGE });
  });

  it('returns null for other errors so the route keeps its generic 500', () => {
    expect(aiQuotaResponse(new Error('boom'))).toBeNull();
  });
});
