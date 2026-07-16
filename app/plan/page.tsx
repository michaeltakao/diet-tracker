'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, CalendarDays, Dumbbell, Plus, Trash2,
  Check, ChevronDown, ChevronUp, Zap, Copy,
  Brain, Moon, Flame, RefreshCw, AlertTriangle, Link2,
} from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  getPrograms, getActiveProgram, activateProgram, deleteProgram,
  saveProgram, getTemplates, getTodaySession, createProgram, createSession,
} from '@/lib/data/training-plan';
import { fmtMonthDayDowLongJa, fmtLongEn } from '@/lib/format-date';
import { getCheckIn, saveCheckIn, todayDate } from '@/lib/data/checkin';
import { getHealthProfile } from '@/lib/data/health-profile';
import { getGoals } from '@/lib/data/profile';
import { getAllPersonalRecords } from '@/lib/data/workout';
import { getWorkoutEntriesForRange } from '@/lib/data/workout';
import type {
  TrainingProgram, TrainingSession, PlannedExercise,
  DailyCheckIn, WorkoutSuggestion, MusclePart,
} from '@/lib/types';
import BottomNav from '@/components/BottomNav';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { postJson, HttpError } from '@/lib/httpClient';

// ── Constants ──────────────────────────────────────────────────────────────

const DOW_JA = ['日', '月', '火', '水', '木', '金', '土'];
const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MUSCLE_COLORS: Record<string, string> = {
  chest:     'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
  back:      'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  legs:      'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  shoulders: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  arms:      'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  abs:       'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
};

const MUSCLE_LABELS_JA: Record<string, string> = {
  chest: '胸', back: '背中', legs: '脚', shoulders: '肩', arms: '腕', abs: '腹',
};
const MUSCLE_LABELS_EN: Record<string, string> = {
  chest: 'Chest', back: 'Back', legs: 'Legs', shoulders: 'Shoulders', arms: 'Arms', abs: 'Abs',
};

const MOOD_EMOJIS = ['', '😞', '😕', '😐', '😊', '🔥'];
const ENERGY_EMOJIS = ['', '💀', '😴', '⚡', '💪', '🚀'];
const MOOD_LABELS_JA  = ['', '最悪', '悪い', '普通', '良い', '最高'];
const MOOD_LABELS_EN  = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Great'];
const ENERGY_LABELS_JA = ['', '消耗', '疲れ', '普通', '元気', '絶好調'];
const ENERGY_LABELS_EN = ['', 'Drained', 'Tired', 'Normal', 'Energized', 'Peak'];

const PROCEED_STYLES_BG: Record<string, { bg: string; text: string }> = {
  full:        { bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300' },
  reduced:     { bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300' },
  alternative: { bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',    text: 'text-blue-700 dark:text-blue-300'  },
  rest:        { bg: 'bg-surface-2 border-line',     text: 'text-muted'  },
};

type Tab = 'today' | 'schedule' | 'programs';

// ── Sub-components ─────────────────────────────────────────────────────────

function ExerciseRow({ ex }: { ex: PlannedExercise }) {
  const { lang } = useLanguage();
  const MUSCLE_LABELS = lang === 'en' ? MUSCLE_LABELS_EN : MUSCLE_LABELS_JA;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-line last:border-0">
      <span className={`text-xs font-black px-2 py-0.5 rounded-full shrink-0 ${MUSCLE_COLORS[ex.musclePart] ?? ''}`}>
        {MUSCLE_LABELS[ex.musclePart]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-fg truncate">{ex.name}</p>
        {ex.notes && <p className="text-xs text-faint truncate">{ex.notes}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-xs font-black text-muted tabular-nums">
          {ex.sets}×{ex.repsMin === ex.repsMax ? ex.repsMin : `${ex.repsMin}–${ex.repsMax}`}
        </p>
        {ex.targetWeight != null && (
          <p className="text-xs text-faint">{ex.targetWeight} kg</p>
        )}
      </div>
    </div>
  );
}

function SessionCard({
  session, defaultOpen = false,
}: {
  session: TrainingSession; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { t, lang } = useLanguage();
  const MUSCLE_LABELS = lang === 'en' ? MUSCLE_LABELS_EN : MUSCLE_LABELS_JA;
  const muscles = [...new Set(session.exercises.map(e => e.musclePart))];

  return (
    <div className="border border-line rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-3 hover:bg-surface-2 transition-colors"
      >
        <Dumbbell size={14} className="text-faint shrink-0" />
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-fg">{session.name}</p>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {muscles.map(m => (
              <span key={m} className={`text-xs font-black px-1.5 py-0.5 rounded-full ${MUSCLE_COLORS[m]}`}>
                {MUSCLE_LABELS[m]}
              </span>
            ))}
          </div>
        </div>
        <span className="text-xs text-faint shrink-0">{session.exercises.length} {t.exercisesCountSuffix}</span>
        {open ? <ChevronUp size={14} className="text-faint" /> : <ChevronDown size={14} className="text-faint" />}
      </button>
      {open && (
        <div className="px-3 pb-2 border-t border-line">
          {session.exercises.map(ex => <ExerciseRow key={ex.id} ex={ex} />)}
        </div>
      )}
    </div>
  );
}

function ProgramCard({
  program, isActive, onActivate, onDelete, onDuplicate,
}: {
  program: TrainingProgram;
  isActive: boolean;
  onActivate: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-all ${
      isActive
        ? 'border-green-400 dark:border-green-600 shadow-[0_0_0_2px_rgba(34,197,94,0.15)]'
        : 'border-line'
    }`}>
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {isActive && (
                <span className="text-xs font-black text-white bg-brand-600 px-2 py-0.5 rounded-full">
                  {t.activeProgramBadge}
                </span>
              )}
              <h3 className="text-sm font-black text-fg truncate">{program.name}</h3>
            </div>
            <p className="text-[11px] text-faint leading-relaxed">{program.description}</p>
            <p className="text-xs text-faint mt-1">{program.sessions.length} {t.sessionsCountSuffix}</p>
          </div>
          <button
            onClick={() => setOpen(v => !v)}
            className="text-faint hover:text-muted p-1"
          >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          {!isActive && (
            <button
              onClick={onActivate}
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white hover:bg-green-600 transition-colors"
            >
              {t.startProgram}
            </button>
          )}
          <button
            onClick={onDuplicate}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-surface-2 text-faint hover:bg-line transition-colors"
          >
            <Copy size={13} />
          </button>
          {!isActive && (
            <button
              onClick={onDelete}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-red-50 dark:bg-red-900/20 text-red-400 hover:bg-red-100 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-line p-3 space-y-2">
          {program.sessions.map(s => <SessionCard key={s.id} session={s} />)}
        </div>
      )}
    </div>
  );
}

// ── CheckIn Widget ─────────────────────────────────────────────────────────

const ALL_MUSCLES: MusclePart[] = ['chest', 'back', 'legs', 'shoulders', 'arms', 'abs'];

function CheckInWidget({
  value,
  onChange,
  onSave,
}: {
  value: DailyCheckIn;
  onChange: (v: DailyCheckIn) => void;
  onSave: (v: DailyCheckIn) => void;
}) {
  const [expanded, setExpanded] = useState(!value.mood);
  const { t, lang } = useLanguage();
  const MUSCLE_LABELS = lang === 'en' ? MUSCLE_LABELS_EN : MUSCLE_LABELS_JA;
  const MOOD_LABELS   = lang === 'en' ? MOOD_LABELS_EN  : MOOD_LABELS_JA;
  const ENERGY_LABELS = lang === 'en' ? ENERGY_LABELS_EN : ENERGY_LABELS_JA;

  const set = (partial: Partial<DailyCheckIn>) => onChange({ ...value, ...partial });

  const toggleSoreness = (part: MusclePart) => {
    const areas = value.sorenessAreas.includes(part)
      ? value.sorenessAreas.filter(p => p !== part)
      : [...value.sorenessAreas, part];
    set({ sorenessAreas: areas });
  };

  return (
    <div className="bg-card rounded-3xl border border-line overflow-hidden shadow-[0_4px_16px_rgb(0,0,0,0.04)]">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors"
      >
        <div className="w-9 h-9 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
          <Brain size={17} className="text-purple-500" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-black text-fg">{t.dailyCheckInTitle}</p>
          {value.mood ? (
            <p className="text-xs text-faint mt-0.5">
              {t.moodLabel} {MOOD_EMOJIS[value.mood]}  {t.energyLabel} {ENERGY_EMOJIS[value.energy]}  {t.sleepLabel} {value.sleepHours}h
            </p>
          ) : (
            <p className="text-xs text-faint mt-0.5">{t.tapToRecord}</p>
          )}
        </div>
        {value.mood > 0 && (
          <span className="text-xs font-black text-brand bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">{t.recordedLabel}</span>
        )}
        {expanded ? <ChevronUp size={15} className="text-faint" /> : <ChevronDown size={15} className="text-faint" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-line space-y-4 pt-3">

          {/* Mood */}
          <div>
            <p className="text-xs font-black text-faint mb-2">{t.moodLabel}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => set({ mood: n as DailyCheckIn['mood'] })}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border-2 transition-all ${
                    value.mood === n
                      ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-line hover:border-line-strong'
                  }`}
                >
                  <span className="text-lg">{MOOD_EMOJIS[n]}</span>
                  <span className="text-xs font-bold text-faint">{MOOD_LABELS[n]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Energy */}
          <div>
            <p className="text-xs font-black text-faint mb-2">{t.energyLabel}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => set({ energy: n as DailyCheckIn['energy'] })}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border-2 transition-all ${
                    value.energy === n
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                      : 'border-line hover:border-line-strong'
                  }`}
                >
                  <span className="text-lg">{ENERGY_EMOJIS[n]}</span>
                  <span className="text-xs font-bold text-faint">{ENERGY_LABELS[n]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sleep */}
          <div>
            <p className="text-xs font-black text-faint mb-2 flex items-center gap-1.5">
              <Moon size={12} className="text-indigo-400" />
              {t.sleepLabel}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => set({ sleepHours: Math.max(0, value.sleepHours - 0.5) })}
                className="w-9 h-9 rounded-xl border border-line-strong flex items-center justify-center text-faint hover:bg-surface-2 transition-colors font-bold text-lg"
              >−</button>
              <div className="flex-1 text-center">
                <span className="text-2xl font-black text-fg tabular-nums">{value.sleepHours}</span>
                <span className="text-sm text-faint ml-1">{t.hoursSuffix}</span>
              </div>
              <button
                onClick={() => set({ sleepHours: Math.min(14, value.sleepHours + 0.5) })}
                className="w-9 h-9 rounded-xl border border-line-strong flex items-center justify-center text-faint hover:bg-surface-2 transition-colors font-bold text-lg"
              >＋</button>
            </div>
          </div>

          {/* Sleep quality (optional 1–5 self-rating — recorded, not judged) */}
          <div>
            <p className="text-xs font-black text-faint mb-2">{t.sleepQualityLabel}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => set({ sleepQuality: (value.sleepQuality === n ? undefined : n) as DailyCheckIn['sleepQuality'] })}
                  aria-pressed={value.sleepQuality === n}
                  className={`flex-1 py-2 rounded-xl border-2 text-sm font-black tabular-nums transition-all ${
                    value.sleepQuality === n
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300'
                      : 'border-line text-faint hover:border-line-strong'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Stress level (optional 1–5 self-rating) */}
          <div>
            <p className="text-xs font-black text-faint mb-2">{t.stressLevelLabel}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => set({ stressLevel: (value.stressLevel === n ? undefined : n) as DailyCheckIn['stressLevel'] })}
                  aria-pressed={value.stressLevel === n}
                  className={`flex-1 py-2 rounded-xl border-2 text-sm font-black tabular-nums transition-all ${
                    value.stressLevel === n
                      ? 'border-teal-400 bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-300'
                      : 'border-line text-faint hover:border-line-strong'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Soreness */}
          <div>
            <p className="text-xs font-black text-faint mb-2 flex items-center gap-1.5">
              <Flame size={12} className="text-orange-400" />
              {t.sorenessLabel}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {ALL_MUSCLES.map(m => (
                <button
                  key={m}
                  onClick={() => toggleSoreness(m)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${
                    value.sorenessAreas.includes(m)
                      ? `${MUSCLE_COLORS[m]} border-current`
                      : 'border-line-strong text-faint hover:border-line-strong'
                  }`}
                >
                  {MUSCLE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-black text-faint mb-2">{t.notesOptional}</p>
            <textarea
              value={value.notes ?? ''}
              onChange={e => set({ notes: e.target.value })}
              placeholder={t.notesPlaceholder}
              rows={2}
              className="w-full text-sm px-3 py-2 rounded-xl border border-line-strong bg-surface-2 text-muted placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
            />
          </div>

          <button
            onClick={() => { onSave(value); setExpanded(false); }}
            disabled={!value.mood || !value.energy}
            className="w-full py-2.5 rounded-2xl text-sm font-bold bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t.saveCheckIn}
          </button>
        </div>
      )}
    </div>
  );
}

// ── AI Suggestion Card ─────────────────────────────────────────────────────

function SuggestionCard({
  suggestion,
  loading,
  error,
  onRefresh,
}: {
  suggestion: WorkoutSuggestion | null;
  loading: boolean;
  error: 'auth' | 'error' | null;
  onRefresh: () => void;
}) {
  const { t } = useLanguage();
  const PROCEED_STYLES = {
    full:        { ...PROCEED_STYLES_BG.full,        label: t.proceedFull },
    reduced:     { ...PROCEED_STYLES_BG.reduced,     label: t.proceedReduced },
    alternative: { ...PROCEED_STYLES_BG.alternative, label: t.proceedAlternative },
    rest:        { ...PROCEED_STYLES_BG.rest,         label: t.proceedRest },
  } as Record<string, { bg: string; text: string; label: string }>;
  if (loading) {
    return (
      <div className="bg-card rounded-3xl border border-line p-4 shadow-[0_4px_16px_rgb(0,0,0,0.04)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center animate-pulse shrink-0">
            <Zap size={17} className="text-indigo-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-fg">{t.aiAnalyzingTitle}</p>
            <p className="text-xs text-faint">{t.aiGeneratingDesc}</p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {[40, 60, 30].map((w, i) => (
            <div key={i} className={`h-3 bg-surface-2 rounded-full animate-pulse`} style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error === 'auth') {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-200 dark:border-blue-800 p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <Zap size={17} className="text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-blue-700 dark:text-blue-300">{t.aiLoginRequiredTitle}</p>
            <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">{t.checkInSavedDesc}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error === 'error') {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-3xl border border-red-200 dark:border-red-800 p-4 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-red-600 dark:text-red-400">{t.aiSuggestionFailed}</p>
        <button onClick={onRefresh} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-500 text-xs font-bold hover:bg-red-200 transition-colors">
          <RefreshCw size={12} />
          再試行
        </button>
      </div>
    );
  }

  if (!suggestion) return null;

  const style = PROCEED_STYLES[suggestion.proceed] ?? PROCEED_STYLES.full;

  return (
    <div className={`rounded-3xl border p-4 ${style.bg} shadow-[0_4px_16px_rgb(0,0,0,0.04)]`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-card/60 flex items-center justify-center shrink-0">
            <Zap size={17} className={style.text} />
          </div>
          <div>
            <p className={`text-xs font-black uppercase tracking-widest ${style.text} opacity-60`}>{t.aiSuggestionLabel}</p>
            <p className={`text-base font-black ${style.text}`}>{style.label}</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl hover:bg-card/50 transition-colors"
          title="再生成"
        >
          <RefreshCw size={14} className={style.text} />
        </button>
      </div>

      {/* Session name */}
      <p className={`text-sm font-bold ${style.text} mb-2`}>{suggestion.sessionName}</p>

      {/* Intensity note */}
      <p className={`text-xs ${style.text} opacity-80 mb-3 bg-card/40 px-3 py-2 rounded-xl`}>
        {suggestion.intensityNote}
      </p>

      {/* Adjustments */}
      {suggestion.adjustments.length > 0 && (
        <div className="mb-3">
          <p className={`text-xs font-black uppercase tracking-widest ${style.text} opacity-50 mb-1.5`}>{t.adjustmentsLabel}</p>
          <div className="space-y-1">
            {suggestion.adjustments.map((adj, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle size={11} className={`${style.text} opacity-60 mt-0.5 shrink-0`} />
                <p className={`text-xs ${style.text} opacity-80`}>{adj}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recovery tips */}
      {suggestion.recoveryTips.length > 0 && (
        <div className="mb-3">
          <p className={`text-xs font-black uppercase tracking-widest ${style.text} opacity-50 mb-1.5`}>{t.recoveryLabel}</p>
          <div className="space-y-1">
            {suggestion.recoveryTips.map((tip, i) => (
              <p key={i} className={`text-xs ${style.text} opacity-80`}>• {tip}</p>
            ))}
          </div>
        </div>
      )}

      {/* Motivation */}
      <div className={`border-t border-current border-opacity-10 pt-3`}>
        <p className={`text-sm font-black ${style.text}`}>{suggestion.motivationMessage}</p>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function PlanPage() {
  const router = useRouter();
  const { isAuthenticated } = useProfile();
  const { t, lang } = useLanguage();
  const today = todayDate();
  const DOW = lang === 'en' ? DOW_EN : DOW_JA;

  const [tab, setTab]               = useState<Tab>('today');
  const [programs, setPrograms]     = useState<TrainingProgram[]>([]);
  const [active, setActive]         = useState<TrainingProgram | null>(null);
  const [todaySession, setTodaySession] = useState<TrainingSession | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates] = useState<TrainingProgram[]>(getTemplates);

  const [checkIn, setCheckIn] = useState<DailyCheckIn>({
    date: today,
    mood: 0 as DailyCheckIn['mood'],
    energy: 0 as DailyCheckIn['energy'],
    sleepHours: 7,
    sorenessAreas: [],
  });

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showNewProgram, setShowNewProgram] = useState(false);

  const [suggestion, setSuggestion] = useState<WorkoutSuggestion | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState<'auth' | 'error' | null>(null);

  const reload = () => {
    const progs = getPrograms();
    setPrograms(progs);
    setActive(getActiveProgram());
    setTodaySession(getTodaySession());
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount/date change
    reload();
    const saved = getCheckIn(today);
    if (saved) setCheckIn(saved);
  }, [today]);

  const fetchSuggestion = useCallback(async (ci: DailyCheckIn) => {
    if (!ci.mood || !ci.energy) return;
    setSuggestionLoading(true);
    setSuggestion(null);
    setSuggestionError(null);
    try {
      const session = getTodaySession();
      const profile = getHealthProfile();
      const goals   = getGoals();
      const prs     = getAllPersonalRecords();

      // Recent 7 days of workouts
      const end   = today;
      const start = (() => {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })();
      const recentWorkouts = getWorkoutEntriesForRange(start, end).map(e => ({
        date: e.date, name: e.name, musclePart: e.musclePart,
      }));
      const personalRecords = Object.values(prs).map(r => ({
        name: r.exerciseName, weight: r.maxWeight, date: r.date,
      }));

      const body = {
        today,
        checkIn: {
          mood:          ci.mood,
          energy:        ci.energy,
          sleepHours:    ci.sleepHours,
          sorenessAreas: ci.sorenessAreas,
          notes:         ci.notes,
        },
        plannedSession: session ? {
          name:      session.name,
          exercises: session.exercises.map(e => ({
            name: e.name, musclePart: e.musclePart,
            sets: e.sets, repsMin: e.repsMin, repsMax: e.repsMax,
            targetWeight: e.targetWeight,
          })),
        } : null,
        fitnessGoal:      profile.fitnessGoal,
        // goalWeight is only ever present when the user set it (never a fabricated
        // default), so no getRealGoals() gate is needed here (P0 #4b).
        targetWeight:     goals.goalWeight,
        recentWorkouts,
        personalRecords,
        healthConditions: profile.healthConditions,
        medications:      profile.medications ?? [],
      };

      const data = await postJson<WorkoutSuggestion>('/api/suggest-workout', body);
      // The route returns 200 after only JSON.parse (no shape validation), so the
      // model can omit array fields — normalize them so the card can render safely.
      setSuggestion({
        ...data,
        adjustments:  Array.isArray(data.adjustments)  ? data.adjustments  : [],
        recoveryTips: Array.isArray(data.recoveryTips) ? data.recoveryTips : [],
      });
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) {
        setSuggestionError('auth');
      } else {
        setSuggestionError('error');
      }
    } finally {
      setSuggestionLoading(false);
    }
  }, [today]);

  // Auto-fetch suggestion when check-in is already saved
  useEffect(() => {
    const saved = getCheckIn(today);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot auto-fetch when a saved check-in already exists
    if (saved?.mood && saved?.energy) fetchSuggestion(saved);
  }, [today, fetchSuggestion]);

  const handleCheckInSave = (ci: DailyCheckIn) => {
    setCheckIn(ci);
    saveCheckIn(ci);
    fetchSuggestion(ci);
  };

  const handleActivate = (id: string) => { activateProgram(id); reload(); };

  const handleDelete = (id: string) => setDeleteTargetId(id);

  const confirmDelete = () => {
    if (deleteTargetId) {
      deleteProgram(deleteTargetId);
      reload();
    }
    setDeleteTargetId(null);
  };

  const handleDuplicate = (prog: TrainingProgram) => {
    const copy: TrainingProgram = {
      ...prog,
      id: crypto.randomUUID(),
      name: prog.name + (lang === 'en' ? ' (Copy)' : ' (コピー)'),
      isActive: false,
      createdAt: new Date().toISOString(),
    };
    saveProgram(copy);
    reload();
  };

  const handleUseTemplate = (tmpl: TrainingProgram) => {
    saveProgram(tmpl);
    reload();
    setShowTemplates(false);
  };

  const handleScheduleChange = (dow: number, sessionId: string) => {
    if (!active) return;
    const updated: TrainingProgram = {
      ...active,
      weekSchedule: { ...active.weekSchedule, [dow]: sessionId },
    };
    saveProgram(updated);
    reload();
  };

  const cardCls = 'bg-card rounded-3xl border border-line p-4 shadow-[0_4px_16px_rgb(0,0,0,0.04)]';

  return (
    <div className="max-w-md lg:max-w-2xl mx-auto pb-28 lg:pb-8 px-4 lg:px-6 bg-[var(--background)] min-h-screen">

      {/* Header */}
      <div className="flex items-center gap-3 pt-6 pb-4">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-2xl bg-card shadow-sm border border-line flex items-center justify-center text-faint hover:scale-105 active:scale-95 transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-black text-fg tracking-tight flex items-center gap-2">
          <CalendarDays size={22} className="text-blue-500" />
          トレーニング計画
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-2 rounded-2xl p-1 gap-1 mb-4">
        {([
          { key: 'today',    label: lang === 'en' ? 'Today'    : '今日' },
          { key: 'schedule', label: lang === 'en' ? 'Schedule' : '週スケジュール' },
          { key: 'programs', label: lang === 'en' ? 'Programs' : 'プログラム' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`
              flex-1 py-2 rounded-xl text-xs font-bold transition-all
              ${tab === key
                ? 'bg-surface-2 text-fg shadow-sm'
                : 'text-faint hover:text-muted'}
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TODAY TAB ─────────────────────────────────────────────────────── */}
      {tab === 'today' && (
        <div className="space-y-3">

          {/* Check-in widget */}
          <CheckInWidget
            value={checkIn}
            onChange={setCheckIn}
            onSave={handleCheckInSave}
          />

          {/* AI Suggestion */}
          {(suggestion || suggestionLoading || suggestionError) && (
            <SuggestionCard
              suggestion={suggestion}
              loading={suggestionLoading}
              error={suggestionError}
              onRefresh={() => fetchSuggestion(checkIn)}
            />
          )}

          {/* Account link nudge — shown only when Supabase is set up but user is guest */}
          {isSupabaseConfigured() && !isAuthenticated && suggestion && (
            <button
              onClick={() => router.push('/settings')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-left"
            >
              <Link2 size={15} className="text-blue-500 shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-bold text-blue-700 dark:text-blue-300">{t.accountLinkTitle}</p>
                <p className="text-[11px] text-blue-500 dark:text-blue-400">{t.accountLinkDesc}</p>
              </div>
              <span className="text-xs font-black text-blue-500 bg-blue-100 dark:bg-blue-900/40 px-2 py-1 rounded-full shrink-0">{lang === 'en' ? 'Settings →' : '設定 →'}</span>
            </button>
          )}

          {/* Today's planned session */}
          {todaySession ? (
            <>
              <div className={cardCls}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-black text-faint uppercase tracking-widest">
                      {lang === 'en' ? fmtLongEn(today) : fmtMonthDayDowLongJa(today)}
                    </p>
                    <h2 className="text-xl font-black text-fg mt-0.5">
                      {todaySession.name}
                    </h2>
                  </div>
                  <button
                    onClick={() => router.push('/workout')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold bg-gradient-to-r from-brand-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(34,197,94,0.35)] hover:opacity-90 transition-all"
                  >
                    <Zap size={13} />
                    {lang === 'en' ? 'Start' : '開始'}
                  </button>
                </div>
                <div className="space-y-1">
                  {todaySession.exercises.map(ex => <ExerciseRow key={ex.id} ex={ex} />)}
                </div>
              </div>

              {/* Volume summary */}
              <div className={`${cardCls} grid grid-cols-3 gap-3 text-center`}>
                <div>
                  <p className="text-2xl font-black text-fg tabular-nums">
                    {todaySession.exercises.length}
                  </p>
                  <p className="text-xs text-faint">{t.exerciseCountLabel}</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-fg tabular-nums">
                    {todaySession.exercises.reduce((s, e) => s + e.sets, 0)}
                  </p>
                  <p className="text-xs text-faint">{t.totalSetsLabel}</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-fg tabular-nums">
                    {[...new Set(todaySession.exercises.map(e => e.musclePart))].length}
                  </p>
                  <p className="text-xs text-faint">{t.musclePartLabel}</p>
                </div>
              </div>
            </>
          ) : (
            <div className={`${cardCls} text-center py-10`}>
              <CalendarDays size={40} className="text-faint mx-auto mb-3" />
              <p className="text-sm font-bold text-faint mb-1">
                {active
                  ? (lang === 'en' ? 'Today is a rest day 🛌' : '今日は休息日です 🛌')
                  : (lang === 'en' ? 'No program set' : 'プログラムが設定されていません')}
              </p>
              <p className="text-xs text-faint mb-4">
                {active
                  ? (lang === 'en' ? 'Rest up for tomorrow\'s session' : '明日のセッションに備えて休みましょう')
                  : (lang === 'en' ? 'Select a program from the Programs tab' : '「プログラム」タブからプログラムを選択してください')}
              </p>
              {!active && (
                <button
                  onClick={() => setTab('programs')}
                  className="px-5 py-2.5 rounded-2xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                >
                  {lang === 'en' ? 'Choose a Program' : 'プログラムを選ぶ'}
                </button>
              )}
            </div>
          )}

          {/* Upcoming week preview */}
          {active && (
            <div className={cardCls}>
              <p className="text-xs font-black text-faint uppercase tracking-widest mb-3">{t.weekScheduleLabel}</p>
              <div className="space-y-1.5">
                {DOW.map((d, i) => {
                  const sid = active.weekSchedule[i];
                  const sess = active.sessions.find(s => s.id === sid);
                  const isToday = i === new Date().getDay();
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
                        isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <span className={`w-7 text-center text-xs font-black ${
                        isToday ? 'text-blue-600 dark:text-blue-400' : 'text-faint'
                      }`}>{d}</span>
                      {sess ? (
                        <span className="text-xs font-bold text-muted">{sess.name}</span>
                      ) : (
                        <span className="text-xs text-faint">{t.restDayLabel}</span>
                      )}
                      {isToday && <span className="ml-auto text-xs font-black text-blue-500">{t.todayShort}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SCHEDULE TAB ──────────────────────────────────────────────────── */}
      {tab === 'schedule' && (
        <div className="space-y-3">
          {active ? (
            <>
              <div className={cardCls}>
                <p className="text-xs font-black text-faint uppercase tracking-widest mb-1">{t.activeProgramLabel}</p>
                <p className="text-base font-black text-fg mb-3">{active.name}</p>
                <p className="text-xs text-faint mb-3">{t.assignDaysDesc}</p>
                <div className="space-y-2">
                  {DOW.map((d, i) => {
                    const currentId = active.weekSchedule[i] ?? '';
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-6 text-xs font-black text-faint text-center">{d}</span>
                        <select
                          value={currentId}
                          onChange={e => handleScheduleChange(i, e.target.value)}
                          className="flex-1 text-xs font-semibold px-3 py-2 rounded-xl border border-line-strong bg-surface-2 text-muted focus:outline-none focus:ring-2 focus:ring-blue-400"
                        >
                          <option value="">{t.restDayOption}</option>
                          {active.sessions.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={cardCls}>
                <p className="text-xs font-black text-faint uppercase tracking-widest mb-3">{t.sessionListLabel}</p>
                <div className="space-y-2">
                  {active.sessions.map(s => <SessionCard key={s.id} session={s} />)}
                </div>
              </div>
            </>
          ) : (
            <div className={`${cardCls} text-center py-8`}>
              <p className="text-sm font-semibold text-faint">
                {lang === 'en' ? 'Select a program to view its schedule' : 'プログラムを選択するとスケジュールが表示されます'}
              </p>
              <button
                onClick={() => setTab('programs')}
                className="mt-3 px-5 py-2.5 rounded-2xl text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              >
                {lang === 'en' ? 'Choose a Program' : 'プログラムを選ぶ'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PROGRAMS TAB ──────────────────────────────────────────────────── */}
      {tab === 'programs' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setShowTemplates(v => !v)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-[0_4px_12px_rgba(99,102,241,0.35)] hover:opacity-90 transition-all"
            >
              <Zap size={15} />
              {lang === 'en' ? 'Add from Template' : 'テンプレートから追加'}
            </button>
            <button
              onClick={() => setShowNewProgram(true)}
              className="px-4 py-3 rounded-2xl text-sm font-bold bg-surface-2 text-muted hover:bg-line transition-all"
            >
              <Plus size={16} />
            </button>
          </div>

          {showTemplates && (
            <div className={cardCls}>
              <p className="text-xs font-black text-faint uppercase tracking-widest mb-3">{t.templatesLabel}</p>
              <div className="space-y-3">
                {templates.map(tmpl => (
                  <div key={tmpl.id} className="border border-line rounded-2xl p-3">
                    <h4 className="text-sm font-black text-fg mb-0.5">{tmpl.name}</h4>
                    <p className="text-[11px] text-faint mb-2">{tmpl.description}</p>
                    <div className="flex gap-1.5 mb-2 flex-wrap">
                      {tmpl.sessions.map(s => (
                        <span key={s.id} className="text-xs font-bold px-2 py-0.5 bg-surface-2 text-muted rounded-full">
                          {s.name}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => handleUseTemplate(tmpl)}
                      className="w-full py-2 rounded-xl text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Check size={12} />
                      {lang === 'en' ? 'Add' : '追加する'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {programs.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-black text-faint uppercase tracking-widest px-1">{t.myProgramsLabel}</p>
              {programs.map(prog => (
                <ProgramCard
                  key={prog.id}
                  program={prog}
                  isActive={prog.isActive}
                  onActivate={() => handleActivate(prog.id)}
                  onDelete={() => handleDelete(prog.id)}
                  onDuplicate={() => handleDuplicate(prog)}
                />
              ))}
            </div>
          ) : (
            <div className={`${cardCls} text-center py-8`}>
              <Dumbbell size={36} className="text-faint mx-auto mb-3" />
              <p className="text-sm font-semibold text-faint">{t.noProgramsMsg}</p>
              <p className="text-xs text-faint mt-1">{t.noProgramsDescMsg}</p>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteTargetId != null}
        title={t.deleteProgramTitle}
        description={t.deleteProgramConfirmMsg}
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />

      <ConfirmDialog
        open={showNewProgram}
        title={t.newProgramTitle}
        confirmLabel={t.createLabel}
        cancelLabel={t.cancel}
        input={{ label: t.programNameLabel }}
        onConfirm={(name) => {
          const prog = createProgram(name, '', [createSession(lang === 'en' ? 'Session 1' : 'セッション 1', [])]);
          saveProgram(prog);
          reload();
          setShowNewProgram(false);
        }}
        onCancel={() => setShowNewProgram(false)}
      />

      <BottomNav />
    </div>
  );
}
