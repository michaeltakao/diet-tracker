/**
 * IndexedDB outbox for the analysed writes (vault ADR-008 P0-6).
 *
 * fake-indexeddb provides a real IndexedDB implementation in Node; the
 * Supabase side is a small in-memory fake whose failures the tests control.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

// ── Fake Supabase ────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Err = { code?: string; message: string };

const server = {
  tables: new Map<string, Row[]>(),
  /** Error returned by every write (upsert / delete / insert) while set. */
  fail: null as Err | null,
  /** Error for one upsert only, matched by row id. */
  failIds: new Map<string, Err>(),
  log: [] as string[],
  online: true,
  sessionUser: 'u1' as string | null,
};

function rows(t: string): Row[] {
  if (!server.tables.has(t)) server.tables.set(t, []);
  return server.tables.get(t)!;
}

function query(_t: string, terminal: (filters: [string, unknown][]) => unknown) {
  const filters: [string, unknown][] = [];
  const q = {
    eq(col: string, v: unknown) { filters.push([col, v]); return q; },
    maybeSingle: async () => ({ data: (terminal(filters) as Row[])[0] ?? null, error: null }),
    then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
      return Promise.resolve(terminal(filters)).then(res, rej);
    },
  };
  return q;
}

const match = (r: Row, f: [string, unknown][]) => f.every(([c, v]) => r[c] === v);

const supabase = {
  from(t: string) {
    return {
      upsert: async (row: Row, opts: { onConflict: string }) => {
        const err = server.fail ?? server.failIds.get(String(row.id));
        if (err) return { error: err };
        const keys = opts.onConflict.split(',');
        const list = rows(t);
        const i = list.findIndex((r) => keys.every((k) => r[k] === row[k]));
        if (i >= 0) list[i] = { ...row }; else list.push({ ...row });
        server.log.push(`upsert ${t} ${row.id} ${row.weight_kg ?? ''}`.trim());
        return { error: null };
      },
      delete: () => query(t, (f) => {
        if (server.fail) return { error: server.fail };
        server.tables.set(t, rows(t).filter((r) => !match(r, f)));
        server.log.push(`delete ${t} ${f.find(([c]) => c === 'id')?.[1]}`);
        return { error: null };
      }),
      select: () => query(t, (f) => rows(t).filter((r) => match(r, f))),
      insert: async (row: Row) => {
        if (server.fail) return { error: server.fail };
        rows(t).push({ ...row });
        return { error: null };
      },
    };
  },
  auth: {
    getSession: async () => ({
      data: { session: server.sessionUser ? { user: { id: server.sessionUser } } : null },
    }),
  },
};

vi.mock('../_write', () => ({
  // Offline: getUser() cannot reach the server → no write context.
  getWriteContext: async () =>
    server.online && server.sessionUser ? { userId: server.sessionUser, supabase } : null,
}));
vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  createClient: () => supabase,
}));

import {
  write, flush, listQueued, getCounters, reportHealth, coalesceKey,
  isPermanentError, __resetOutboxForTests, type OutboxOp,
} from '../outbox';

const NETWORK: Err = { message: 'TypeError: Failed to fetch', code: '' };

const weight = (id: string, kg: number, at: string, date = '2026-11-09'): OutboxOp => ({
  kind: 'upsert', table: 'weight_logs',
  row: { id, logged_date: date, weight_kg: kg, logged_at: at },
  onConflict: 'user_id,logged_date',
});
const food = (id: string): OutboxOp => ({
  kind: 'upsert', table: 'food_logs',
  row: { id, logged_date: '2026-11-09', name: 'rice', calories: 250, logged_at: '2026-11-09T03:00:00.000Z' },
  onConflict: 'id',
});

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  __resetOutboxForTests();
  server.tables.clear();
  server.fail = null;
  server.failIds.clear();
  server.log.length = 0;
  server.online = true;
  server.sessionUser = 'u1';
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('coalesceKey / isPermanentError', () => {
  it('weight is keyed by (user, date); food/workout by id; weight delete with date joins the upsert key', () => {
    expect(coalesceKey(weight('w1', 70, 'x'), 'u1')).toBe('weight_logs|u1|2026-11-09');
    expect(coalesceKey({ kind: 'delete', table: 'weight_logs', id: 'w1', loggedDate: '2026-11-09' }, 'u1'))
      .toBe('weight_logs|u1|2026-11-09');
    expect(coalesceKey(food('f1'), 'u1')).toBe('food_logs|u1|id:f1');
    expect(coalesceKey({ kind: 'delete', table: 'food_logs', id: 'f1' }, 'u1')).toBe('food_logs|u1|id:f1');
  });
  it('classifies errors', () => {
    expect(isPermanentError({ code: '23502' })).toBe(true);   // not-null violation
    expect(isPermanentError({ code: '42703' })).toBe(true);   // undefined column
    expect(isPermanentError({ code: 'PGRST204' })).toBe(true);
    expect(isPermanentError({ code: 'PGRST301' })).toBe(false); // JWT expired
    expect(isPermanentError({ code: '' })).toBe(false);         // network
    expect(isPermanentError(null)).toBe(false);
  });
});

describe('outbox', () => {
  it('a failing write is queued, then sent on the next flush', async () => {
    server.fail = NETWORK;
    await write(food('f1'));
    expect(await listQueued()).toHaveLength(1);
    expect(rows('food_logs')).toHaveLength(0);
    expect((await getCounters()).failed).toBe(1);

    server.fail = null;
    await flush();
    expect(await listQueued()).toHaveLength(0);
    expect(rows('food_logs').map((r) => r.id)).toEqual(['f1']);
    expect(rows('food_logs')[0].user_id).toBe('u1');
    expect((await getCounters()).synced).toBe(1);
  });

  it('a successful write leaves nothing queued', async () => {
    await write(food('f1'));
    expect(await listQueued()).toHaveLength(0);
    expect(rows('food_logs')).toHaveLength(1);
  });

  it('same device: a newer weight replaces the queued stale one (stale is never sent)', async () => {
    server.fail = NETWORK;
    await write(weight('w1', 70.0, '2026-11-09T08:00:00.000Z'));
    await write(weight('w2', 71.0, '2026-11-09T09:00:00.000Z'));
    const q = await listQueued();
    expect(q).toHaveLength(1);
    expect((q[0].op as { row: Row }).row.weight_kg).toBe(71);

    server.fail = null;
    await flush();
    expect(rows('weight_logs').map((r) => r.weight_kg)).toEqual([71]);
    expect(server.log).toEqual(['upsert weight_logs w2 71']);
  });

  it('cross-device: a stale queued weight replayed after a newer server write loses', async () => {
    server.fail = NETWORK;
    await write(weight('w1', 70.0, '2026-11-09T08:00:00.000Z'));
    server.fail = null;
    // Another device wrote a newer value for the same day.
    rows('weight_logs').push({ id: 'other', user_id: 'u1', logged_date: '2026-11-09', weight_kg: 72.4, logged_at: '2026-11-09T09:00:00.000Z' });

    await flush();
    expect(rows('weight_logs').map((r) => r.weight_kg)).toEqual([72.4]);
    expect(await listQueued()).toHaveLength(0);
    expect((await getCounters()).superseded).toBe(1);
  });

  it('…but an older server value is overwritten by the newer queued one', async () => {
    rows('weight_logs').push({ id: 'old', user_id: 'u1', logged_date: '2026-11-09', weight_kg: 69, logged_at: '2026-11-09T07:00:00.000Z' });
    await write(weight('w1', 70.0, '2026-11-09T08:00:00.000Z'));
    expect(rows('weight_logs').map((r) => r.weight_kg)).toEqual([70]);
  });

  it('a queued delete cancels the queued upsert: the row is never created', async () => {
    server.fail = NETWORK;
    await write(food('f1'));
    await write({ kind: 'delete', table: 'food_logs', id: 'f1' });
    const q = await listQueued();
    expect(q).toHaveLength(1);
    expect(q[0].op.kind).toBe('delete');

    server.fail = null;
    await flush();
    expect(rows('food_logs')).toHaveLength(0);
    expect(server.log).toEqual(['delete food_logs f1']);
  });

  it('a queued delete of a synced row removes it on replay and it stays deleted', async () => {
    await write(food('f1'));
    expect(rows('food_logs')).toHaveLength(1);
    server.fail = NETWORK;
    await write({ kind: 'delete', table: 'food_logs', id: 'f1' });
    expect(rows('food_logs')).toHaveLength(1);

    server.fail = null;
    await flush();
    await flush(); // a second replay must not resurrect anything
    expect(rows('food_logs')).toHaveLength(0);
    expect(await listQueued()).toHaveLength(0);
  });

  it('items are replayed in sequence order', async () => {
    server.fail = NETWORK;
    await write(food('a'));
    await write(food('b'));
    await write(weight('w', 70, '2026-11-09T08:00:00.000Z'));
    server.fail = null;
    await flush();
    expect(server.log).toEqual(['upsert food_logs a', 'upsert food_logs b', 'upsert weight_logs w 70']);
  });

  it('a permanent error drops that item (counted) without blocking the rest', async () => {
    server.failIds.set('bad', { code: '23502', message: 'null value in column' });
    server.fail = NETWORK;
    await write(food('bad'));
    await write(food('good'));
    server.fail = null;
    await flush();
    expect(rows('food_logs').map((r) => r.id)).toEqual(['good']);
    expect(await listQueued()).toHaveLength(0);
    const c = await getCounters();
    expect(c.dropped).toBe(1);
    expect(c.synced).toBe(1);
  });

  it('offline (session stored, server unreachable): queued, then sent when back online', async () => {
    server.online = false;
    await write(food('f1'));
    expect(await listQueued()).toHaveLength(1);
    expect(rows('food_logs')).toHaveLength(0);

    server.online = true;
    await flush();
    expect(rows('food_logs')).toHaveLength(1);
  });

  it('guest (no session): nothing is queued or sent', async () => {
    server.sessionUser = null;
    await write(food('f1'));
    expect(await listQueued()).toHaveLength(0);
    expect(rows('food_logs')).toHaveLength(0);
  });

  it('another user’s queued items are not sent under the current session', async () => {
    server.online = false;
    await write(food('f1'));            // queued for u1
    server.sessionUser = 'u2';
    server.online = true;
    await flush();
    expect(rows('food_logs')).toHaveLength(0);
    expect(await listQueued()).toHaveLength(1);
  });

  it('the build stamp is captured when the change is made', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_SHA', 'sha-at-write');
    vi.stubEnv('NEXT_PUBLIC_STUDY_BUILD', '1');
    server.fail = NETWORK;
    await write(food('f1'));
    vi.stubEnv('NEXT_PUBLIC_BUILD_SHA', 'sha-later');
    server.fail = null;
    await flush();
    expect(rows('food_logs')[0]).toMatchObject({ build_sha: 'sha-at-write', study_build: true });
  });

  it('concurrent flushes do not double-send', async () => {
    server.fail = NETWORK;
    await write(food('f1'));
    server.fail = null;
    await Promise.all([flush(), flush(), flush()]);
    expect(server.log).toEqual(['upsert food_logs f1']);
  });
});

describe('reportHealth', () => {
  it('inserts the counters since the last report, then resets them', async () => {
    server.fail = NETWORK;
    await write(food('a'));               // failed 1
    server.fail = null;
    await flush();                        // synced 1
    server.fail = NETWORK;
    await write(food('b'));               // failed 2, still queued
    server.fail = null;

    expect(await reportHealth()).toBe(true);
    const [row] = rows('client_sync_health');
    expect(row).toMatchObject({ user_id: 'u1', synced_count: 1, failed_count: 2, dropped_count: 0, queued_count: 1 });
    expect(row.oldest_queued_at).toEqual(expect.any(String));
    expect(await getCounters()).toEqual({ synced: 0, failed: 0, dropped: 0, superseded: 0 });
  });

  it('keeps the counters when the insert fails (e.g. 028 not applied)', async () => {
    server.fail = NETWORK;
    await write(food('a'));
    server.fail = { code: '42P01', message: 'relation "client_sync_health" does not exist' };
    expect(await reportHealth()).toBe(false);
    expect((await getCounters()).failed).toBe(1);
  });
});

describe('data-layer wiring (weight.ts / food.ts)', () => {
  function stubStorage() {
    const store = new Map<string, string>();
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  }

  it('removeWeightEntry finds the date so its delete replaces the queued upsert', async () => {
    stubStorage();
    const { addWeightEntry, removeWeightEntry } = await import('../weight');
    server.fail = NETWORK;
    await addWeightEntry({ id: 'w1', date: '2026-11-09', weight: 72.4, addedAt: '2026-11-09T00:00:00.000Z' });
    await removeWeightEntry('w1');
    const q = await listQueued();
    expect(q).toHaveLength(1);
    expect(q[0].op).toMatchObject({ kind: 'delete', table: 'weight_logs', id: 'w1', loggedDate: '2026-11-09' });
  });

  it('addFoodEntry sends every analysed column', async () => {
    stubStorage();
    const { addFoodEntry } = await import('../food');
    await addFoodEntry({
      id: 'f9', date: '2026-11-09', mealType: 'lunch', name: 'rice', calories: 250,
      protein: 4, fat: 0.5, carbs: 55, addedAt: '2026-11-09T03:00:00.000Z', servings: 1.5,
    });
    expect(rows('food_logs')[0]).toMatchObject({
      id: 'f9', user_id: 'u1', logged_date: '2026-11-09', meal_type: 'lunch', calories: 250,
      protein_g: 4, fat_g: 0.5, carbs_g: 55, servings: 1.5, logged_at: '2026-11-09T03:00:00.000Z',
    });
  });
});

describe('flush snapshot', () => {
  it('an item replaced while a flush is running is not sent from the stale snapshot', async () => {
    server.fail = NETWORK;
    await write(food('a'));
    await write(food('f1'));
    server.fail = null;
    // Slow down the first send so the edit lands mid-flush.
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    server.failIds.clear();
    const origFrom = supabase.from.bind(supabase);
    let first = true;
    vi.spyOn(supabase, 'from').mockImplementation((t: string) => {
      const b = origFrom(t);
      return {
        ...b,
        upsert: async (row: Row, opts: { onConflict: string }) => {
          if (first) { first = false; await gate; }
          return b.upsert(row, opts);
        },
      };
    });
    const running = flush();
    await new Promise((r) => setTimeout(r, 10));
    // User deletes f1 while 'a' is in flight. Its own flush queues behind ours.
    const del = write({ kind: 'delete', table: 'food_logs', id: 'f1' });
    await new Promise((r) => setTimeout(r, 10));
    release();
    await running;
    await del;
    expect(server.log).not.toContain('upsert food_logs f1');
    expect(rows('food_logs').map((r) => r.id)).toEqual(['a']);
  });
});
