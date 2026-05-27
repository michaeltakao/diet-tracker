'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, Check } from 'lucide-react';
import { getAppData, updateGoals } from '@/lib/storage';
import { DailyGoals } from '@/lib/types';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';

interface GoalForm {
  calories:   string;
  protein:    string;
  fat:        string;
  carbs:      string;
  water:      string;
  goalWeight: string;
}

const inputCls = `
  w-full px-3.5 py-3 rounded-2xl text-sm font-semibold
  border border-gray-200 dark:border-gray-600
  bg-white dark:bg-gray-700
  text-gray-800 dark:text-gray-100
  placeholder-gray-300 dark:placeholder-gray-600
  focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent
  transition-all duration-200
  tabular-nums
`;

export default function SettingsPage() {
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();
  const [form, setForm] = useState<GoalForm>({
    calories:   '2000',
    protein:    '150',
    fat:        '60',
    carbs:      '200',
    water:      '2000',
    goalWeight: '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const data = getAppData();
    setForm({
      calories:   String(data.goals.calories),
      protein:    String(data.goals.protein),
      fat:        String(data.goals.fat),
      carbs:      String(data.goals.carbs),
      water:      String(data.goals.water ?? 2000),
      goalWeight: data.goals.goalWeight ? String(data.goals.goalWeight) : '',
    });
  }, []);

  const handleSave = () => {
    const goals: DailyGoals = {
      calories:   Number(form.calories)   || 2000,
      protein:    Number(form.protein)    || 150,
      fat:        Number(form.fat)        || 60,
      carbs:      Number(form.carbs)      || 200,
      water:      Number(form.water)      || 2000,
      goalWeight: form.goalWeight ? Number(form.goalWeight) : undefined,
    };
    updateGoals(goals);
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  };

  const updateField = (field: keyof GoalForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const cardCls = 'bg-white dark:bg-gray-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-50 dark:border-gray-700 p-4';

  return (
    <div className="max-w-md mx-auto pb-28 px-4 bg-[var(--background)] min-h-screen">
      {/* ── Header ────────────────────────────── */}
      <div className="flex items-center gap-3 pt-6 pb-5">
        <button
          onClick={() => router.back()}
          className="
            w-10 h-10 rounded-2xl
            bg-white dark:bg-gray-800
            shadow-[0_4px_12px_rgb(0,0,0,0.06)] dark:shadow-[0_4px_12px_rgb(0,0,0,0.25)]
            border border-gray-100 dark:border-gray-700
            flex items-center justify-center
            text-gray-500 dark:text-gray-400
            hover:text-gray-800 dark:hover:text-gray-200
            hover:scale-[1.04] active:scale-95
            transition-all duration-200
          "
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
          {t.settings} ⚙️
        </h1>
      </div>

      {/* ── Language ──────────────────────────── */}
      <div className={`${cardCls} mb-3`}>
        <label className="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
          {t.language}
        </label>
        <div className="flex gap-2">
          {([
            { code: 'ja' as const, flag: '🇯🇵', label: '日本語' },
            { code: 'en' as const, flag: '🇺🇸', label: 'English' },
          ] as const).map(({ code, flag, label }) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              className={`
                flex-1 py-3 rounded-2xl text-sm font-bold
                flex items-center justify-center gap-2
                transition-all duration-200
                hover:scale-[1.02] active:scale-95
                ${lang === code
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(34,197,94,0.35)]'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}
              `}
            >
              <span>{flag}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Daily Goals ───────────────────────── */}
      <div className={`${cardCls} mb-3 space-y-4`}>
        <p className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
          {t.dailyGoals}
        </p>

        {([
          {
            field:  'calories' as const,
            label:  t.calorieGoal,
            icon:   '🔥',
            accent: 'focus:ring-green-400',
          },
          {
            field:  'protein'  as const,
            label:  t.proteinGoal,
            icon:   '💪',
            accent: 'focus:ring-emerald-400',
          },
          {
            field:  'fat'      as const,
            label:  t.fatGoal,
            icon:   '🥑',
            accent: 'focus:ring-amber-400',
          },
          {
            field:  'carbs'    as const,
            label:  t.carbsGoal,
            icon:   '🌾',
            accent: 'focus:ring-blue-400',
          },
          {
            field:  'water'    as const,
            label:  t.waterGoal,
            icon:   '💧',
            accent: 'focus:ring-sky-400',
          },
        ] as const).map(({ field, label, icon, accent }) => (
          <div key={field}>
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              <span>{icon}</span>
              <span>{label}</span>
            </label>
            <input
              type="number"
              value={form[field]}
              onChange={(e) => updateField(field, e.target.value)}
              min="0"
              className={`${inputCls} ${accent}`}
            />
          </div>
        ))}
      </div>

      {/* ── Weight Goal ───────────────────────── */}
      <div className={`${cardCls} mb-5`}>
        <p className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">
          ⚖️ {t.weightGoal}
        </p>
        <input
          type="number"
          value={form.goalWeight}
          onChange={(e) => updateField('goalWeight', e.target.value)}
          placeholder="例: 65.0"
          min="20"
          max="300"
          step="0.1"
          className={`${inputCls} focus:ring-indigo-400`}
        />
        {form.goalWeight && (
          <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium mt-2 text-right animate-slide-in-up">
            目標: {form.goalWeight} kg
          </p>
        )}
      </div>

      {/* ── Save button ───────────────────────── */}
      <button
        onClick={handleSave}
        className={`
          w-full font-black py-4 rounded-2xl
          flex items-center justify-center gap-2.5
          transition-all duration-300
          hover:scale-[1.01] active:scale-[0.98]
          text-sm
          ${saved
            ? 'bg-emerald-500 text-white shadow-[0_4px_14px_rgba(34,197,94,0.4)]'
            : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-[0_4px_14px_rgba(34,197,94,0.35)] hover:from-green-600 hover:to-emerald-700'}
        `}
      >
        {saved ? (
          <>
            <Check size={18} strokeWidth={3} />
            {t.saved}
          </>
        ) : (
          <>
            <Save size={17} />
            {t.saveSettings}
          </>
        )}
      </button>

      <BottomNav />
    </div>
  );
}
