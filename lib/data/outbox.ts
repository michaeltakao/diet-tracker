/**
 * Outbox for the analysed Supabase writes (vault ADR-008 P0-6).
 *
 * Before this, food / weight / workout rows were written to localStorage
 * and then sent to Supabase fire-and-forget: on any failure (offline, token
 * refresh, 5xx) the row existed only on the phone, and nothing recorded the
 * loss. The study's outcomes are computed from Supabase, so each silent
 * failure was missing data that looked like non-use.
 *
 * Design — write-through outbox in IndexedDB (localStorage is the store that
 * fills up, B3):
 *
 *   write(op) ─► enqueue (IndexedDB) ─► flush() ─► Supabase
 *
 * - Every write for the three tables goes through the queue, success or not,
 *   so one ordered path carries all of them (seq = IndexedDB autoIncrement).
 * - Coalescing: an item replaces every queued item with the same key, so a
 *   stale value can never be sent after a newer one. Keys: weight =
 *   `(user_id, logged_date)` (weight_logs upserts on that pair); food and
 *   workout = row id. A queued delete replaces a queued upsert of the same
 *   row, so a deleted row is never re-created by a replay.
 * - Last-write-wins across devices for weight: before sending an upsert, the
 *   existing row's logged_at is read; a newer server row wins and the queued
 *   item is dropped as superseded.
 * - flush() is serialised (one promise chain per tab) and sends items in seq
 *   order. A transient error (network, auth refresh, 5xx) stops the flush and
 *   keeps the item; a permanent one (constraint / type / schema error) drops
 *   it so one bad row cannot block the queue — and is counted.
 * - Counters (synced / failed attempts / dropped / superseded) are kept in
 *   IndexedDB and reported once per app open as one client_sync_health row
 *   (migration 028), so silent loss is visible per participant.
 *
 * Without IndexedDB (very old browsers, some private modes) write() falls
 * back to the old direct send. Guests (no session) are never queued: their
 * data is local-only by design.
 */

import type { PostgrestError } from '@supabase/supabase-js';
import { getWriteContext, type WriteContext } from './_write';
import { buildStamp, writeStamped, type BuildStamp } from '@/lib/build-stamp';
import { createClient, isSupabaseConfigured } from '@/lib/supabase';
import type { TablesInsert } from '@/lib/database.types';

export type OutboxTable = 'food_logs' | 'weight_logs' | 'workout_logs';

/** Row payload as sent to PostgREST (without user_id / build stamp). */
export type OutboxRow = Record<string, unknown> & { id: string; logged_date: string; logged_at?: string | null };

/**
 * Compile-time column check for the row builders (foodRow / workoutRow):
 * the table's Insert type minus what the outbox adds itself.
 */
export type RowFor<T extends OutboxTable> =
  Omit<TablesInsert<T>, 'user_id' | 'build_sha' | 'study_build'> & { id: string; logged_date: string };

export type OutboxOp =
  | { kind: 'upsert'; table: OutboxTable; row: OutboxRow; onConflict: string }
  | { kind: 'delete'; table: OutboxTable; id: string; /** weight only: coalesces with the date's upsert */ loggedDate?: string };

export interface OutboxItem {
  /** IndexedDB autoIncrement key — client-side sequence number. */
  seq?: number;
  key: string;
  userId: string;
  op: OutboxOp;
  /** Build stamp captured when the user made the change. */
  stamp: BuildStamp;
  queuedAt: string;
  attempts: number;
  lastError?: string;
}

export interface OutboxCounters {
  synced: number;
  failed: number;
  dropped: number;
  superseded: number;
}

const DB_NAME = 'dt-outbox';
const DB_VERSION = 1;
const ITEMS = 'items';
const META = 'meta';
const COUNTERS_KEY = 'counters';

const ZERO: OutboxCounters = { synced: 0, failed: 0, dropped: 0, superseded: 0 };

// ── Keys ──────────────────────────────────────────────────────────────────────

/** Coalescing key: items with equal keys describe the same server row. */
export function coalesceKey(op: OutboxOp, userId: string): string {
  if (op.table === 'weight_logs') {
    const date = op.kind === 'upsert' ? op.row.logged_date : op.loggedDate;
    if (date) return `weight_logs|${userId}|${date}`;
  }
  const id = op.kind === 'upsert' ? op.row.id : op.id;
  return `${op.table}|${userId}|id:${id}`;
}

// ── IndexedDB primitives ─────────────────────────────────────────────────────

function idb(): IDBFactory | null {
  try {
    return typeof indexedDB !== 'undefined' ? indexedDB : null;
  } catch {
    return null; // some sandboxed iframes throw on access
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  const factory = idb();
  if (!factory) return Promise.reject(new Error('IndexedDB unavailable'));
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const items = db.createObjectStore(ITEMS, { keyPath: 'seq', autoIncrement: true });
      items.createIndex('key', 'key', { unique: false });
      items.createIndex('userId', 'userId', { unique: false });
      db.createObjectStore(META);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function reqP<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });
}

/**
 * Add an item, first deleting every queued item with the same key (in one
 * transaction). Returns the new item's seq.
 */
export async function enqueue(item: Omit<OutboxItem, 'seq'>): Promise<number> {
  const db = await openDb();
  const tx = db.transaction(ITEMS, 'readwrite');
  const store = tx.objectStore(ITEMS);
  const older = await reqP(store.index('key').getAllKeys(item.key));
  for (const seq of older) store.delete(seq);
  const seq = (await reqP(store.add(item))) as number;
  await txDone(tx);
  return seq;
}

/** Queued items, oldest first; only `userId`'s when given. */
export async function listQueued(userId?: string): Promise<OutboxItem[]> {
  const db = await openDb();
  const tx = db.transaction(ITEMS, 'readonly');
  const store = tx.objectStore(ITEMS);
  const items = userId
    ? await reqP(store.index('userId').getAll(userId) as IDBRequest<OutboxItem[]>)
    : await reqP(store.getAll() as IDBRequest<OutboxItem[]>);
  return items.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

async function removeItem(seq: number): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(ITEMS, 'readwrite');
  tx.objectStore(ITEMS).delete(seq);
  await txDone(tx);
}

/**
 * Update a queued item's attempt count — unless it was replaced (coalesced)
 * while the send was in flight, in which case there is nothing to update.
 */
async function markAttempt(seq: number, lastError: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(ITEMS, 'readwrite');
  const store = tx.objectStore(ITEMS);
  const cur = (await reqP(store.get(seq))) as OutboxItem | undefined;
  if (cur) store.put({ ...cur, attempts: cur.attempts + 1, lastError });
  await txDone(tx);
}

export async function getCounters(): Promise<OutboxCounters> {
  const db = await openDb();
  const tx = db.transaction(META, 'readonly');
  const v = (await reqP(tx.objectStore(META).get(COUNTERS_KEY))) as OutboxCounters | undefined;
  return { ...ZERO, ...v };
}

/** Add (or, with negative values, subtract) to the stored counters. */
async function bumpCounters(delta: Partial<OutboxCounters>): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(META, 'readwrite');
  const store = tx.objectStore(META);
  const cur = { ...ZERO, ...((await reqP(store.get(COUNTERS_KEY))) as OutboxCounters | undefined) };
  for (const k of Object.keys(delta) as (keyof OutboxCounters)[]) {
    cur[k] = Math.max(0, cur[k] + (delta[k] ?? 0));
  }
  store.put(cur, COUNTERS_KEY);
  await txDone(tx);
}

// ── Sending ──────────────────────────────────────────────────────────────────

type SendResult = 'ok' | 'superseded' | { error: PostgrestError | Error; permanent: boolean };

/**
 * Errors that will fail the same way on every retry: Postgres data /
 * integrity / syntax-or-schema classes (22, 23, 42) and PostgREST request
 * errors (PGRST1xx / PGRST2xx). JWT problems (PGRST3xx), network failures
 * (no code) and 5xx are transient.
 */
export function isPermanentError(error: { code?: string | null } | null | undefined): boolean {
  const code = error?.code ?? '';
  return /^(22|23|42)/.test(code) || /^PGRST[12]\d\d$/.test(code);
}

async function sendItem(ctx: WriteContext, item: OutboxItem): Promise<SendResult> {
  const { op, stamp } = item;
  try {
    if (op.kind === 'delete') {
      const { error } = await ctx.supabase.from(op.table).delete().eq('id', op.id).eq('user_id', ctx.userId);
      return error ? { error, permanent: isPermanentError(error) } : 'ok';
    }

    if (op.table === 'weight_logs' && op.row.logged_at) {
      // Cross-device last-write-wins on (user_id, logged_date).
      const { data, error } = await ctx.supabase
        .from('weight_logs')
        .select('logged_at')
        .eq('user_id', ctx.userId)
        .eq('logged_date', op.row.logged_date)
        .maybeSingle();
      if (error) return { error, permanent: isPermanentError(error) };
      const existing = (data as { logged_at?: string | null } | null)?.logged_at;
      if (existing && Date.parse(existing) > Date.parse(op.row.logged_at)) return 'superseded';
    }

    const { error } = await writeStamped((s) =>
      // `s` is {} when the stamp columns are missing (027 not applied); the
      // stamp captured at enqueue time is used otherwise.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table is a runtime union; payload shape is per-table (see callers)
      (ctx.supabase.from(op.table) as any).upsert(
        { ...op.row, user_id: ctx.userId, ...(Object.keys(s).length > 0 ? stamp : {}) },
        { onConflict: op.onConflict },
      ),
    );
    return error ? { error, permanent: isPermanentError(error) } : 'ok';
  } catch (e) {
    // fetch() rejections (offline) land here: transient.
    return { error: e instanceof Error ? e : new Error(String(e)), permanent: false };
  }
}

let flushChain: Promise<FlushResult> = Promise.resolve({ sent: 0, remaining: 0 });

export interface FlushResult {
  sent: number;
  remaining: number;
}

/**
 * Send the signed-in user's queued items in order. Serialised: concurrent
 * calls queue behind each other within a tab, and across tabs through a Web
 * Lock where the browser has them. Never throws.
 */
export function flush(): Promise<FlushResult> {
  flushChain = flushChain.then(flushLocked, flushLocked);
  return flushChain;
}

async function flushLocked(): Promise<FlushResult> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return flushOnce();
  try {
    return await locks.request('dt-outbox-flush', () => flushOnce());
  } catch {
    return flushOnce(); // lock manager unavailable (e.g. opaque origin)
  }
}

async function stillQueued(seq: number): Promise<boolean> {
  const db = await openDb();
  const tx = db.transaction(ITEMS, 'readonly');
  return (await reqP(tx.objectStore(ITEMS).count(seq))) > 0;
}

async function flushOnce(): Promise<FlushResult> {
  try {
    if (!idb()) return { sent: 0, remaining: 0 };
    const ctx = await getWriteContext();
    if (!ctx) return { sent: 0, remaining: (await listQueued()).length };
    const items = await listQueued(ctx.userId);
    let sent = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // Replaced by a newer write since the list was read: that newer item
      // (higher seq) is sent by the flush its own write() queued.
      if (!(await stillQueued(item.seq!))) continue;
      const res = await sendItem(ctx, item);
      if (res === 'ok' || res === 'superseded') {
        await removeItem(item.seq!);
        await bumpCounters(res === 'ok' ? { synced: 1 } : { superseded: 1 });
        sent++;
        continue;
      }
      const msg = res.error.message || String(res.error);
      if (res.permanent) {
        console.warn('[outbox] dropped (permanent error):', item.op.kind, item.op.table, msg);
        await removeItem(item.seq!);
        await bumpCounters({ dropped: 1 });
        continue;
      }
      console.warn('[outbox] send failed, kept for retry:', item.op.table, msg);
      await markAttempt(item.seq!, msg);
      await bumpCounters({ failed: 1 });
      return { sent, remaining: items.length - i };
    }
    return { sent, remaining: 0 };
  } catch (e) {
    console.warn('[outbox] flush error:', e);
    return { sent: 0, remaining: -1 };
  }
}

// ── Public write entry point ─────────────────────────────────────────────────

/**
 * User id for queueing. getWriteContext() validates the session with the
 * server (getUser), which fails offline — exactly when queueing matters. So
 * fall back to the locally stored session; flush() only sends items whose
 * userId matches the server-validated user, and RLS enforces it again.
 */
async function queueUserId(): Promise<string | null> {
  const ctx = await getWriteContext();
  if (ctx) return ctx.userId;
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await createClient().auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Queue one analysed write and try to send it. Resolves once the send
 * attempt is over (callers already treat these writes as fire-and-forget).
 */
export async function write(op: OutboxOp): Promise<void> {
  const userId = await queueUserId();
  if (!userId) return; // guest: local-only by design

  const item: Omit<OutboxItem, 'seq'> = {
    key: coalesceKey(op, userId),
    userId,
    op,
    stamp: buildStamp(),
    queuedAt: new Date().toISOString(),
    attempts: 0,
  };

  try {
    await enqueue(item);
  } catch (e) {
    // No IndexedDB: old behaviour (direct send, loss only logged).
    console.warn('[outbox] IndexedDB unavailable, sending directly:', e);
    const ctx = await getWriteContext();
    if (!ctx) return;
    const res = await sendItem(ctx, { ...item, seq: -1 });
    if (res !== 'ok' && res !== 'superseded') {
      console.warn('[outbox] direct write failed:', op.table, res.error.message);
    }
    return;
  }
  await flush();
}

// ── Health report (migration 028) ────────────────────────────────────────────

/**
 * Insert one client_sync_health row with the counters accumulated since the
 * last successful report, then subtract what was reported. Called once per
 * app open after a flush. If 028 is not applied the insert fails and the
 * counters simply keep accumulating. Never throws.
 */
export async function reportHealth(): Promise<boolean> {
  try {
    if (!idb()) return false;
    const ctx = await getWriteContext();
    if (!ctx) return false;
    const counters = await getCounters();
    const queued = await listQueued(ctx.userId);
    const stamp = buildStamp();
    const { error } = await ctx.supabase.from('client_sync_health').insert({
      user_id: ctx.userId,
      synced_count: counters.synced,
      failed_count: counters.failed,
      dropped_count: counters.dropped,
      superseded_count: counters.superseded,
      queued_count: queued.length,
      oldest_queued_at: queued[0]?.queuedAt ?? null,
      build_sha: stamp.build_sha,
      study_build: stamp.study_build,
    });
    if (error) {
      console.warn('[outbox] health report failed:', error.message);
      return false;
    }
    await bumpCounters({
      synced: -counters.synced,
      failed: -counters.failed,
      dropped: -counters.dropped,
      superseded: -counters.superseded,
    });
    return true;
  } catch (e) {
    console.warn('[outbox] health report error:', e);
    return false;
  }
}

/** Test hook: forget the cached connection (fake-indexeddb is reset per test). */
export function __resetOutboxForTests(): void {
  dbPromise = null;
  flushChain = Promise.resolve({ sent: 0, remaining: 0 });
}
