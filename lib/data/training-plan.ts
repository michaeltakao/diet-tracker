/**
 * Training program persistence.
 * Writes to localStorage immediately; syncs to Supabase when authenticated.
 */

import type { TrainingProgram, TrainingSession, PlannedExercise } from '@/lib/types';
import type { Json } from '@/lib/database.types';
import { getWriteContext } from './_write';

const KEY = 'diet-tracker-training-plans';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── Read / Write ───────────────────────────────────────────────────────────

export function getPrograms(): TrainingProgram[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TrainingProgram[]) : [];
  } catch {
    return [];
  }
}

function save(programs: TrainingProgram[]): void {
  localStorage.setItem(KEY, JSON.stringify(programs));
}

export function getActiveProgram(): TrainingProgram | null {
  return getPrograms().find(p => p.isActive) ?? null;
}

export async function saveProgram(program: TrainingProgram): Promise<void> {
  const programs = getPrograms().filter(p => p.id !== program.id);
  save([...programs, program]);

  const ctx = await getWriteContext();
  if (!ctx) return;
  const { error } = await ctx.supabase
    .from('training_programs')
    .upsert(
      {
        user_id:   ctx.userId,
        client_id: program.id,
        data:      program as unknown as Json,
        is_active: program.isActive,
      },
      { onConflict: 'user_id,client_id' },
    );
  if (error) console.warn('[data/training-plan] saveProgram Supabase failed:', error.message);
}

export async function activateProgram(id: string): Promise<void> {
  const programs = getPrograms().map(p => ({ ...p, isActive: p.id === id }));
  save(programs);

  const ctx = await getWriteContext();
  if (!ctx) return;
  // Deactivate all, then activate target
  const deactivate = programs
    .filter(p => !p.isActive)
    .map(p => ctx.supabase
      .from('training_programs')
      .update({ is_active: false })
      .eq('user_id', ctx.userId)
      .eq('client_id', p.id),
    );
  const activate = ctx.supabase
    .from('training_programs')
    .update({ is_active: true })
    .eq('user_id', ctx.userId)
    .eq('client_id', id);
  await Promise.all([...deactivate, activate]);
}

export async function deleteProgram(id: string): Promise<void> {
  save(getPrograms().filter(p => p.id !== id));

  const ctx = await getWriteContext();
  if (!ctx) return;
  const { error } = await ctx.supabase
    .from('training_programs')
    .delete()
    .eq('user_id', ctx.userId)
    .eq('client_id', id);
  if (error) console.warn('[data/training-plan] deleteProgram Supabase failed:', error.message);
}

/** Today's planned session based on active program + weekSchedule. */
export function getTodaySession(): TrainingSession | null {
  const active = getActiveProgram();
  if (!active) return null;
  const dow = new Date().getDay(); // 0=Sun
  const sessionId = active.weekSchedule[dow];
  if (!sessionId) return null;
  return active.sessions.find(s => s.id === sessionId) ?? null;
}

// ── Factories ──────────────────────────────────────────────────────────────

export function createExercise(
  name: string,
  musclePart: PlannedExercise['musclePart'],
  sets: number,
  repsMin: number,
  repsMax: number,
  targetWeight?: number,
  notes?: string,
): PlannedExercise {
  return { id: uid(), name, musclePart, sets, repsMin, repsMax, targetWeight, notes };
}

export function createSession(name: string, exercises: PlannedExercise[]): TrainingSession {
  return { id: uid(), name, exercises };
}

export function createProgram(
  name: string,
  description: string,
  sessions: TrainingSession[],
  weekSchedule: Record<number, string> = {},
): TrainingProgram {
  return {
    id: uid(),
    name,
    description,
    sessions,
    weekSchedule,
    isActive: false,
    createdAt: new Date().toISOString(),
  };
}

// ── Built-in templates ─────────────────────────────────────────────────────

export function getTemplates(): TrainingProgram[] {
  const e = createExercise;

  // PPL 6日
  const pushA = createSession('Push A（胸・肩・三頭）', [
    e('ベンチプレス',     'chest',     4, 6, 10, 60),
    e('インクラインダンベルプレス', 'chest', 3, 8, 12, 20),
    e('ショルダープレス', 'shoulders', 3, 8, 12, 30),
    e('サイドレイズ',     'shoulders', 3, 12, 15, 10),
    e('トライセップスプレスダウン', 'arms', 3, 10, 15, 25),
  ]);
  const pullA = createSession('Pull A（背中・二頭）', [
    e('デッドリフト',     'back',  3, 5, 8, 80),
    e('ベントオーバーロウ', 'back', 3, 6, 10, 50),
    e('ラットプルダウン', 'back',  3, 10, 12, 45),
    e('フェイスプル',     'back',  3, 12, 15, 20),
    e('バーベルカール',   'arms',  3, 8, 12, 30),
  ]);
  const legsA = createSession('Legs A（脚）', [
    e('スクワット',       'legs',  4, 5, 8, 80),
    e('レッグプレス',     'legs',  3, 10, 15, 100),
    e('ルーマニアンデッドリフト', 'legs', 3, 8, 12, 60),
    e('レッグカール',     'legs',  3, 10, 15, 30),
    e('カーフレイズ',     'legs',  4, 15, 20, 40),
  ]);

  // Upper / Lower 4日
  const upperA = createSession('Upper A', [
    e('ベンチプレス',        'chest',     4, 5, 8, 60),
    e('ベントオーバーロウ',  'back',      4, 5, 8, 55),
    e('ショルダープレス',    'shoulders', 3, 8, 12, 30),
    e('ラットプルダウン',    'back',      3, 10, 12, 45),
    e('アームカール',        'arms',      2, 10, 15, 15),
    e('トライセップスEZ',    'arms',      2, 10, 15, 20),
  ]);
  const upperB = createSession('Upper B', [
    e('インクラインプレス',  'chest',     4, 8, 12, 50),
    e('シーテッドロウ',      'back',      4, 8, 12, 50),
    e('ダンベルプレス',      'shoulders', 3, 10, 15, 16),
    e('チンニング',          'back',      3, 6, 10),
    e('ハンマーカール',      'arms',      2, 10, 15, 14),
    e('スカルクラッシャー',  'arms',      2, 10, 15, 15),
  ]);
  const lowerA = createSession('Lower A', [
    e('スクワット',               'legs', 4, 5, 8, 80),
    e('ルーマニアンデッドリフト', 'legs', 3, 8, 12, 60),
    e('レッグカール',             'legs', 3, 10, 15, 30),
    e('カーフレイズ',             'legs', 3, 15, 20, 40),
    e('プランク',                 'abs',  3, 30, 60),
  ]);
  const lowerB = createSession('Lower B', [
    e('デッドリフト',     'legs', 4, 4, 6, 100),
    e('ブルガリアンスプリットスクワット', 'legs', 3, 8, 12, 20),
    e('レッグエクステンション', 'legs', 3, 12, 15, 35),
    e('グルートブリッジ', 'legs', 3, 12, 20),
    e('クランチ',         'abs',  3, 15, 25),
  ]);

  // 全身3日
  const fullA = createSession('全身 A', [
    e('スクワット',       'legs',      3, 5, 8, 70),
    e('ベンチプレス',     'chest',     3, 5, 8, 55),
    e('ベントオーバーロウ', 'back',    3, 5, 8, 50),
    e('ショルダープレス', 'shoulders', 3, 8, 12, 25),
    e('プランク',         'abs',       2, 30, 60),
  ]);
  const fullB = createSession('全身 B', [
    e('デッドリフト',     'legs',  3, 4, 6, 90),
    e('インクラインプレス', 'chest', 3, 8, 12, 45),
    e('チンニング',        'back',  3, 6, 10),
    e('サイドレイズ',      'shoulders', 3, 12, 15, 10),
    e('クランチ',          'abs',  3, 15, 20),
  ]);

  const pplSessions = [pushA, pullA, legsA,
    createSession('Push B（胸・肩・三頭）', [...pushA.exercises]),
    createSession('Pull B（背中・二頭）', [...pullA.exercises]),
    createSession('Legs B（脚）', [...legsA.exercises]),
  ];

  return [
    {
      ...createProgram(
        'PPL 6日分割',
        'Push/Pull/Legs を週2サイクル。筋肥大・筋力向上に最適な中〜上級者向けプログラム。',
        pplSessions,
        { 1: pplSessions[0].id, 2: pplSessions[1].id, 3: pplSessions[2].id,
          4: pplSessions[3].id, 5: pplSessions[4].id, 6: pplSessions[5].id },
      ),
    },
    {
      ...createProgram(
        'Upper / Lower 4日',
        '上半身・下半身を交互にトレーニング。週4回の中級者に最適なプログラム。',
        [upperA, lowerA, upperB, lowerB],
        { 1: upperA.id, 2: lowerA.id, 4: upperB.id, 5: lowerB.id },
      ),
    },
    {
      ...createProgram(
        '全身トレ 3日（初心者〜中級者）',
        '月・水・金の全身トレーニング。体全体をバランスよく鍛える入門プログラム。',
        [fullA, fullB],
        { 1: fullA.id, 3: fullB.id, 5: fullA.id },
      ),
    },
  ];
}
