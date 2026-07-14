'use client';

/**
 * 60-second onboarding wizard (FTUE design §2, D4–D5).
 *
 * 4 chip questions — goal / body (birth year・sex・height・weight) /
 * experience / today's environment — every step skippable with an explicit
 * labeled default, followed by a result screen: deterministic TDEE +
 * kcal/PFC targets (食事摂取基準 2025 via recommendedGoals, Mifflin-St Jeor
 * when the body step is fully specified), each with a 1-line WHY, then a
 * first-workout CTA. Numbers carry a 仮 badge until calibrated by real logs.
 *
 * Persistence on finish (all through lib/data, ADR-006):
 * - fitnessGoal + experience → health profile (always)
 * - age/sex/height → health profile, weight → weight log (only when the
 *   body step was confirmed — defaults are for computation, never logged
 *   as measurements)
 * - computed targets → updateGoals (always; kills the fake dashboard
 *   defaults for this device)
 * - completion record + dt-onboarded cookie → lib/data/onboarding
 *
 * The forced redirect here lives in proxy.ts (dt-onboarded cookie gate).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Minus, Plus, Sparkles } from 'lucide-react';
import {
  getHealthProfile,
  updateHealthProfile,
  getLatestWeightEntry,
  addWeightEntry,
  getGoals,
  updateGoals,
} from '@/lib/data';
import {
  completeOnboarding,
  skipOnboarding,
  type OnboardingAnswers,
  type TrainingEnvironment,
} from '@/lib/data/onboarding';
import { recommendedGoals, isSenior } from '@/lib/nutrition-standards';
import { estimateTdee } from '@/lib/tdee';
import { todayStr } from '@/lib/format-date';
import { CARD_CLASS as CARD } from '@/components/ui/Card';
import { ChipGroup } from '@/components/onboarding/ChipGroup';
import type { DailyGoals, ExperienceLevel, FitnessGoal } from '@/lib/types';

// ── Chip vocabularies (labels mirror app/settings/page.tsx) ──────────────────

const GOALS: Array<{ value: FitnessGoal; label: string; icon: string }> = [
  { value: 'weight_loss',  label: '減量',       icon: '📉' },
  { value: 'muscle_gain',  label: '筋肉増量',   icon: '💪' },
  { value: 'maintenance',  label: '維持',       icon: '⚖️' },
  { value: 'endurance',    label: '持久力向上', icon: '🏃' },
  { value: 'flexibility',  label: '柔軟性向上', icon: '🧘' },
];

const SEXES: Array<{ value: 'male' | 'female' | 'unset'; label: string }> = [
  { value: 'male',   label: '男性' },
  { value: 'female', label: '女性' },
  { value: 'unset',  label: '回答しない' },
];

const EXPERIENCES: Array<{ value: ExperienceLevel; label: string; icon: string }> = [
  { value: 'beginner',     label: 'はじめて',       icon: '🌱' },
  { value: 'intermediate', label: '経験あり',       icon: '🏋️' },
  { value: 'advanced',     label: 'しっかり継続中', icon: '🔥' },
];

const ENVIRONMENTS: Array<{ value: TrainingEnvironment; label: string; icon: string }> = [
  { value: 'home',    label: '自宅',   icon: '🏠' },
  { value: 'gym',     label: 'ジム',   icon: '🏢' },
  { value: 'outside', label: '外',     icon: '🌤' },
];

const MINUTES: Array<{ value: '10' | '20' | '30' | '45'; label: string }> = [
  { value: '10', label: '10分' },
  { value: '20', label: '20分' },
  { value: '30', label: '30分' },
  { value: '45', label: '45分以上' },
];

// ── Explicit body-step defaults (used for computation when skipped) ──────────

const CURRENT_YEAR = new Date().getFullYear();
const DEFAULT_BIRTH_YEAR = CURRENT_YEAR - 25;
const DEFAULT_HEIGHT_CM = 165;
const DEFAULT_WEIGHT_KG = 60;

// ── Small numeric stepper ─────────────────────────────────────────────────────

function Stepper({
  label, value, unit, smallStep, bigStep, min, max, onChange,
}: {
  label: string; value: number; unit: string;
  smallStep: number; bigStep: number; min: number; max: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const btn = `
    w-9 h-9 rounded-xl bg-surface-2 text-muted hover:bg-line
    flex items-center justify-center font-bold
    transition-all active:scale-90
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
  `;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-bold text-muted shrink-0">{label}</span>
      <div className="flex items-center gap-1.5" role="group" aria-label={label}>
        <button type="button" className={btn} aria-label={`${label}を${bigStep}減らす`}
          onClick={() => onChange(clamp(value - bigStep))}>
          <Minus size={12} /><Minus size={12} className="-ml-2" />
        </button>
        <button type="button" className={btn} aria-label={`${label}を${smallStep}減らす`}
          onClick={() => onChange(clamp(value - smallStep))}>
          <Minus size={14} />
        </button>
        <span className="min-w-[5.5rem] text-center text-base font-black text-fg tabular-nums">
          {value}
          <span className="text-xs font-bold text-faint ml-0.5">{unit}</span>
        </span>
        <button type="button" className={btn} aria-label={`${label}を${smallStep}増やす`}
          onClick={() => onChange(clamp(value + smallStep))}>
          <Plus size={14} />
        </button>
        <button type="button" className={btn} aria-label={`${label}を${bigStep}増やす`}
          onClick={() => onChange(clamp(value + bigStep))}>
          <Plus size={12} /><Plus size={12} className="-ml-2" />
        </button>
      </div>
    </div>
  );
}

// ── Wizard ────────────────────────────────────────────────────────────────────

type StepId = 'goal' | 'body' | 'experience' | 'environment';
const STEPS: StepId[] = ['goal', 'body', 'experience', 'environment'];

interface ResultNumbers {
  tdee:       number;
  isMifflin:  boolean; // true = Mifflin-St Jeor (full body data); false = 食事摂取基準 EER
  goals:      DailyGoals;
  seniorFloor: boolean;
  sexAveraged: boolean;
  bodyDefaulted: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);           // 0..3 questions, 4 = result
  const [result, setResult] = useState<ResultNumbers | null>(null);

  // Answers (pre-filled from an existing profile — returning user, new device)
  const [goal, setGoal] = useState<FitnessGoal>('maintenance');
  const [birthYear, setBirthYear] = useState(DEFAULT_BIRTH_YEAR);
  const [sex, setSex] = useState<'male' | 'female' | 'unset'>('unset');
  const [heightCm, setHeightCm] = useState(DEFAULT_HEIGHT_CM);
  const [weightKg, setWeightKg] = useState(DEFAULT_WEIGHT_KG);
  const [experience, setExperience] = useState<ExperienceLevel>('beginner');
  const [environment, setEnvironment] = useState<TrainingEnvironment>('home');
  const [minutes, setMinutes] = useState<'10' | '20' | '30' | '45'>('20');
  const [defaultedSteps, setDefaultedSteps] = useState<StepId[]>([]);

  useEffect(() => {
    const profile = getHealthProfile();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    setGoal(profile.fitnessGoal);
    if (profile.age) setBirthYear(CURRENT_YEAR - profile.age);
    if (profile.sex) setSex(profile.sex);
    if (profile.heightCm) setHeightCm(Math.round(profile.heightCm));
    if (profile.experience) setExperience(profile.experience);
    const latest = getLatestWeightEntry();
    if (latest) setWeightKg(Math.round(latest.weight));
  }, []);

  const finish = (finalDefaulted: StepId[]) => {
    const confirmed = !finalDefaulted.includes('body');
    const age = CURRENT_YEAR - birthYear; // year-precision approximation (仮)
    const sexValue = sex === 'unset' ? null : sex;

    // Persist through the existing stores (guest → localStorage-only; the
    // dual-write layers no-op without an authenticated Supabase session).
    const profile = getHealthProfile();
    updateHealthProfile({
      ...profile,
      fitnessGoal: goal,
      experience,
      ...(confirmed ? { age, sex: sexValue, heightCm } : {}),
    });
    if (confirmed) {
      void addWeightEntry({
        id: crypto.randomUUID(),
        date: todayStr(),
        weight: weightKg,
        addedAt: new Date().toISOString(),
      });
    }

    // Deterministic targets: 食事摂取基準 2025 (never a deficit — safety
    // engine owns pace); Mifflin-St Jeor TDEE when body data is complete.
    const goals = recommendedGoals(
      { age, sex: sexValue, activityLevel: 'moderately_active' },
      weightKg,
    );
    const mifflin = estimateTdee({
      weightLogs: [{ date: todayStr(), weightKg }],
      calorieLogs: [],
      prevTdee: null,
      weightKg, heightCm, age,
      sex: sexValue,
      activityLevel: 'moderately_active',
    });
    if (goals) {
      updateGoals({ ...goals, goalWeight: getGoals().goalWeight });
      const proteinRdaOnly = recommendedGoals(
        { age, sex: sexValue, activityLevel: 'moderately_active' }, null,
      );
      setResult({
        tdee: mifflin.tdeeKcal ?? goals.calories,
        isMifflin: mifflin.tdeeKcal != null,
        goals,
        seniorFloor: isSenior(age) && goals.protein !== (proteinRdaOnly?.protein ?? goals.protein),
        sexAveraged: sexValue == null,
        bodyDefaulted: !confirmed,
      });
    }

    const answers: OnboardingAnswers = {
      fitnessGoal: goal,
      birthYear: confirmed ? birthYear : null,
      sex: confirmed ? sexValue : null,
      heightCm: confirmed ? heightCm : null,
      weightKg: confirmed ? weightKg : null,
      experience,
      environment,
      availableMinutes: Number(minutes),
      defaultedSteps: finalDefaulted,
    };
    completeOnboarding(answers);
    setStepIdx(STEPS.length); // result screen
  };

  const advance = (skipped: boolean) => {
    const step = STEPS[stepIdx];
    const nextDefaulted = skipped
      ? [...defaultedSteps.filter(s => s !== step), step]
      : defaultedSteps.filter(s => s !== step);
    setDefaultedSteps(nextDefaulted);
    if (stepIdx < STEPS.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      finish(nextDefaulted);
    }
  };

  const skipAll = () => {
    skipOnboarding();
    router.replace('/');
  };

  // ── Result screen (D5) ──────────────────────────────────────────────────────
  if (stepIdx >= STEPS.length && result) {
    const envLabel = ENVIRONMENTS.find(e => e.value === environment);
    const why = {
      tdee: result.isMifflin
        ? 'Mifflin-St Jeor式（体重・身長・年齢・性別）による推定。食事と体重の記録が7日たまると実測ベースに切り替わります。'
        : '食事摂取基準2025の推定エネルギー必要量（年齢・活動量ベース）。記録がたまると実測ベースに切り替わります。',
      calories: '目標は摂取基準の必要量そのまま＝安全側。減量・増量ペースは記録がたまってから調整します。',
      protein: result.seniorFloor
        ? '65歳以上は筋量維持のため体重×1.0g/日を下限にしています（摂取基準の推奨量より優先）。'
        : '食事摂取基準のたんぱく質推奨量です。',
      fat: '脂質の目標量（エネルギー比20–30%）の中央値です。',
      carbs: '炭水化物の目標量（エネルギー比50–65%）の中央値です。',
    };
    return (
      <div className="min-h-screen max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={20} className="text-brand-500" />
          <h1 className="text-lg font-black text-fg">あなたの最初の目標</h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">仮</span>
        </div>
        {(result.bodyDefaulted || result.sexAveraged) && (
          <p className="text-[11px] text-faint mb-3">
            {result.bodyDefaulted
              ? `体のデータは仮の標準値（${CURRENT_YEAR - DEFAULT_BIRTH_YEAR}歳・${DEFAULT_HEIGHT_CM}cm・${DEFAULT_WEIGHT_KG}kg）で計算しています。設定からいつでも変更できます。`
              : '性別未回答のため、男女平均の基準値で計算しています。'}
          </p>
        )}

        <div className={`${CARD} p-5 mb-3`}>
          <p className="text-xs font-black text-faint uppercase tracking-widest mb-1">推定消費カロリー（TDEE）</p>
          <p className="text-3xl font-black text-fg">{Math.round(result.tdee).toLocaleString()} <span className="text-sm">kcal/日</span></p>
          <p className="text-[11px] text-faint mt-2">{why.tdee}</p>
        </div>

        <div className={`${CARD} p-5 mb-3 space-y-3`}>
          <p className="text-xs font-black text-faint uppercase tracking-widest">1日の目標</p>
          {([
            ['カロリー', `${result.goals.calories.toLocaleString()} kcal`, why.calories],
            ['たんぱく質', `${result.goals.protein} g`, why.protein],
            ['脂質', `${result.goals.fat} g`, why.fat],
            ['炭水化物', `${result.goals.carbs} g`, why.carbs],
          ] as const).map(([label, val, whyLine]) => (
            <div key={label}>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-muted">{label}</span>
                <span className="text-base font-black text-fg tabular-nums">{val}</span>
              </div>
              <p className="text-[11px] text-faint">{whyLine}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => router.replace('/workout')}
          className="w-full py-4 rounded-2xl text-sm font-black text-white
            bg-gradient-to-r from-brand-500 to-brand-600 shadow-[0_4px_14px_rgba(16,185,129,0.35)]
            hover:from-brand-600 hover:to-brand-700 transition-all active:scale-95
            flex items-center justify-center gap-2"
        >
          {envLabel?.icon} {envLabel?.label}で{minutes === '45' ? '45分' : `${minutes}分`}のはじめてワークアウトへ
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => router.replace('/')}
          className="w-full py-3 mt-2 rounded-2xl text-xs font-bold text-muted hover:bg-surface-2 transition-all"
        >
          ダッシュボードを見る
        </button>
      </div>
    );
  }

  // ── Question steps ──────────────────────────────────────────────────────────
  const step = STEPS[stepIdx];
  const stepMeta: Record<StepId, { title: string; skipNote: string }> = {
    goal:        { title: 'いちばん近い目標は？',       skipNote: 'スキップ＝「維持」で始めます' },
    body:        { title: 'あなたの体のこと',           skipNote: `スキップ＝仮の標準値（${CURRENT_YEAR - DEFAULT_BIRTH_YEAR}歳・${DEFAULT_HEIGHT_CM}cm・${DEFAULT_WEIGHT_KG}kg）で計算` },
    experience:  { title: '運動の経験は？',             skipNote: 'スキップ＝「はじめて」向けで始めます' },
    environment: { title: '今日はどこで動けそう？',     skipNote: 'スキップ＝「自宅で20分」で提案します' },
  };

  return (
    <div className="min-h-screen max-w-lg mx-auto px-4 py-6 flex flex-col">
      {/* Header: back / progress / あとで */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setStepIdx(Math.max(0, stepIdx - 1))}
          disabled={stepIdx === 0}
          aria-label="前へ"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-muted
            hover:bg-surface-2 disabled:opacity-0 transition-all"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-1.5" aria-label={`ステップ ${stepIdx + 1} / ${STEPS.length}`}>
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 rounded-full transition-all ${i === stepIdx ? 'w-6 bg-brand-500' : 'w-1.5 bg-line'}`} />
          ))}
        </div>
        <button onClick={skipAll} className="text-xs font-bold text-faint hover:text-muted transition-all">
          あとで
        </button>
      </div>

      <h1 className="text-xl font-black text-fg mb-1">{stepMeta[step].title}</h1>
      <p className="text-[11px] text-faint mb-5">全部で1分・あとから設定でいつでも変更できます</p>

      <div className={`${CARD} p-5`}>
        {step === 'goal' && (
          <ChipGroup label="目標" options={GOALS} value={goal} onChange={setGoal} />
        )}

        {step === 'body' && (
          <div className="space-y-4">
            <ChipGroup label="性別" options={SEXES} value={sex} onChange={setSex} />
            <Stepper label="生まれ年" value={birthYear} unit="年"
              smallStep={1} bigStep={10} min={1930} max={CURRENT_YEAR - 12} onChange={setBirthYear} />
            <Stepper label="身長" value={heightCm} unit="cm"
              smallStep={1} bigStep={5} min={120} max={220} onChange={setHeightCm} />
            <Stepper label="体重" value={weightKg} unit="kg"
              smallStep={1} bigStep={5} min={30} max={200} onChange={setWeightKg} />
            <p className="text-[11px] text-faint">
              TDEE（消費カロリー）と目標値の計算に使います。12歳以上が対象です。
            </p>
          </div>
        )}

        {step === 'experience' && (
          <ChipGroup label="運動経験" options={EXPERIENCES} value={experience} onChange={setExperience} />
        )}

        {step === 'environment' && (
          <div className="space-y-4">
            <ChipGroup label="運動する場所" options={ENVIRONMENTS} value={environment} onChange={setEnvironment} />
            <div>
              <p className="text-xs font-bold text-faint mb-2">使える時間</p>
              <ChipGroup label="使える時間" options={MINUTES} value={minutes} onChange={setMinutes} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto pt-6">
        <button
          onClick={() => advance(false)}
          className="w-full py-4 rounded-2xl text-sm font-black text-white
            bg-gradient-to-r from-brand-500 to-brand-600 shadow-[0_4px_14px_rgba(16,185,129,0.35)]
            hover:from-brand-600 hover:to-brand-700 transition-all active:scale-95
            flex items-center justify-center gap-2"
        >
          {stepIdx === STEPS.length - 1 ? '目標をつくる' : '次へ'}
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => advance(true)}
          className="w-full py-3 mt-2 rounded-2xl text-xs font-bold text-faint hover:text-muted hover:bg-surface-2 transition-all"
        >
          {stepMeta[step].skipNote}
        </button>
      </div>
    </div>
  );
}
