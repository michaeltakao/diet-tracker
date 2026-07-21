'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, CalendarDays, Dumbbell, Plus, Trash2,
  Check, ChevronDown, ChevronUp, Zap, Copy,
} from 'lucide-react';
import {
  getPrograms, getActiveProgram, activateProgram, deleteProgram,
  saveProgram, getTemplates, createProgram, createSession,
} from '@/lib/data/training-plan';
import type {
  TrainingProgram, TrainingSession, PlannedExercise,
} from '@/lib/types';
import BottomNav from '@/components/BottomNav';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useLanguage } from '@/contexts/LanguageContext';

// ── Constants ──────────────────────────────────────────────────────────────

const DOW_JA = ['日', '月', '火', '水', '木', '金', '土'];
const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MUSCLE_COLORS: Record<string, string> = {
  chest:     'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
  back:      'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  legs:      'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  shoulders: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  arms:      'bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400',
  abs:       'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
};

const MUSCLE_LABELS_JA: Record<string, string> = {
  chest: '胸', back: '背中', legs: '脚', shoulders: '肩', arms: '腕', abs: '腹',
};
const MUSCLE_LABELS_EN: Record<string, string> = {
  chest: 'Chest', back: 'Back', legs: 'Legs', shoulders: 'Shoulders', arms: 'Arms', abs: 'Abs',
};

type Tab = 'schedule' | 'programs';

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
        ? 'border-brand-400 dark:border-brand-600 shadow-[0_0_0_2px_rgba(88,204,2,0.15)]'
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
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white hover:bg-brand-600 transition-colors"
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

// ── Main page ──────────────────────────────────────────────────────────────

export default function PlanPage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const DOW = lang === 'en' ? DOW_EN : DOW_JA;

  const [tab, setTab]               = useState<Tab>('schedule');
  const [programs, setPrograms]     = useState<TrainingProgram[]>([]);
  const [active, setActive]         = useState<TrainingProgram | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates] = useState<TrainingProgram[]>(getTemplates);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showNewProgram, setShowNewProgram] = useState(false);

  const reload = () => {
    const progs = getPrograms();
    setPrograms(progs);
    setActive(getActiveProgram());
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    reload();
  }, []);

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

  const cardCls = 'bg-card rounded-2xl border border-line p-4 shadow-[0_4px_16px_rgb(0,0,0,0.04)]';

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
