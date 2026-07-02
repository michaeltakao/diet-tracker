'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, PenLine, Clock, Zap } from 'lucide-react';
import { addFoodEntry, getRecentFoods, getHealthProfile } from '@/lib/data';
import { FoodEntry } from '@/lib/types';
import PhotoUpload from '@/components/PhotoUpload';
import BottomNav from '@/components/BottomNav';
import MedWarning from '@/components/MedWarning';
import { getNutritionWarnings } from '@/lib/medication-rules';
import { useLanguage } from '@/contexts/LanguageContext';

type MealType = FoodEntry['mealType'];
type Tab = 'photo' | 'manual' | 'recent';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function buildTimestamp(date: string, time: string): string {
  // Combine YYYY-MM-DD + HH:MM -> ISO string
  const [h, m] = time.split(':').map(Number);
  const dt = new Date(`${date}T00:00:00`);
  dt.setHours(h, m, 0, 0);
  return dt.toISOString();
}

/** Guess meal type based on current hour */
function guessMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 20) return 'dinner';
  return 'snack';
}

interface FormData {
  name: string;
  mealType: MealType;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
}

const EMPTY_FORM: FormData = {
  name: '',
  mealType: guessMealType(),
  calories: '',
  protein: '',
  fat: '',
  carbs: '',
};

const SPEED_MODE_KEY = 'diet-tracker:speed-mode';

export default function AddPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [tab, setTab]                       = useState<Tab>('photo');
  const [form, setForm]                     = useState<FormData>(EMPTY_FORM);
  const [photoDataUrl, setPhotoDataUrl]     = useState<string | undefined>(undefined);
  const [errors, setErrors]                 = useState<Partial<FormData>>({});
  const [logTime, setLogTime]               = useState(getCurrentTime());
  const [quickAddToast, setQuickAddToast]   = useState(false);
  const [recentFoods, setRecentFoods]       = useState<FoodEntry[]>([]);
  const [nutritionWarnings, setNutritionWarnings] = useState<string[]>([]);
  const [speedMode, setSpeedMode]           = useState(false);
  const [speedToast, setSpeedToast]         = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    setRecentFoods(getRecentFoods(6));
    const profile = getHealthProfile();
    setNutritionWarnings(getNutritionWarnings(profile.healthConditions, profile.medications ?? []));
    setSpeedMode(localStorage.getItem(SPEED_MODE_KEY) === 'true');
  }, []);

  // Auto-refresh time when tab changes to manual so it's fresh
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refresh the timestamp when the user switches to manual entry
    if (tab === 'manual') setLogTime(getCurrentTime());
  }, [tab]);

  const handleAnalysisComplete = (
    result: { name: string; calories: number; protein: number; fat: number; carbs: number },
    photo: string
  ) => {
    setPhotoDataUrl(photo);
    setLogTime(getCurrentTime());
    setForm((prev) => ({
      ...prev,
      name: result.name,
      calories: String(result.calories),
      protein: String(result.protein),
      fat: String(result.fat),
      carbs: String(result.carbs),
    }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<FormData> = {};
    if (!form.name.trim())                          newErrors.name     = '名前を入力してください';
    if (!form.calories || isNaN(Number(form.calories))) newErrors.calories = '数値を入力してください';
    if (!form.protein  || isNaN(Number(form.protein)))  newErrors.protein  = '数値を入力してください';
    if (!form.fat      || isNaN(Number(form.fat)))      newErrors.fat      = '数値を入力してください';
    if (!form.carbs    || isNaN(Number(form.carbs)))    newErrors.carbs    = '数値を入力してください';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const toggleSpeedMode = () => {
    const next = !speedMode;
    setSpeedMode(next);
    localStorage.setItem(SPEED_MODE_KEY, String(next));
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const entry: FoodEntry = {
      id: crypto.randomUUID(),
      date: getTodayDate(),
      mealType: form.mealType,
      name: form.name.trim(),
      calories: Math.round(Number(form.calories)),
      protein:  Math.round(Number(form.protein) * 10) / 10,
      fat:      Math.round(Number(form.fat)     * 10) / 10,
      carbs:    Math.round(Number(form.carbs)   * 10) / 10,
      photoDataUrl,
      addedAt: buildTimestamp(getTodayDate(), logTime),
    };
    void addFoodEntry(entry);
    if (speedMode) {
      setForm({ ...EMPTY_FORM, mealType: form.mealType });
      setPhotoDataUrl(undefined);
      setSpeedToast(true);
      setTimeout(() => setSpeedToast(false), 1500);
    } else {
      router.push('/');
    }
  };

  const handleQuickAdd = (recent: FoodEntry) => {
    void addFoodEntry({
      ...recent,
      id: crypto.randomUUID(),
      date: getTodayDate(),
      mealType: guessMealType(),
      photoDataUrl: undefined,
      addedAt: buildTimestamp(getTodayDate(), getCurrentTime()),
    });
    setRecentFoods(getRecentFoods(6));
    setQuickAddToast(true);
    if (!speedMode) {
      setTimeout(() => router.push('/'), 900);
    } else {
      setTimeout(() => setQuickAddToast(false), 1200);
    }
  };

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const showForm = tab === 'manual' || (tab === 'photo' && form.name !== '');

  const mealTypeLabels: Record<MealType, string> = {
    breakfast: t.breakfast,
    lunch:     t.lunch,
    dinner:    t.dinner,
    snack:     t.snack,
  };

  return (
    <div className="max-w-md lg:max-w-2xl mx-auto pb-28 lg:pb-8 px-4 lg:px-6 bg-[var(--background)] min-h-screen">
      {/* Quick-add success toast */}
      {quickAddToast && (
        <div role="status" aria-live="polite" className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-bold text-sm px-5 py-3 rounded-2xl shadow-lg animate-slide-in-up whitespace-nowrap">
          ✓ {t.quickAddSuccess}
        </div>
      )}

      {/* Speed mode added toast */}
      {speedToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-bold text-sm px-5 py-3 rounded-2xl shadow-lg animate-slide-in-up whitespace-nowrap">
          ✓ {t.quickAddSuccess}
        </div>
      )}

      {/* ── Med / condition warnings ─────────────── */}
      {nutritionWarnings.length > 0 && (
        <div className="pt-4">
          <MedWarning warnings={nutritionWarnings} type="food" collapseAfter={2} />
        </div>
      )}

      {/* ── Header ──────────────────────────────── */}
      <div className="pt-4 pb-3 flex items-center justify-between">
        <h1 className="text-2xl font-black text-fg tracking-tight">{t.addMeal}</h1>
        <div className="flex items-center gap-2">
          {/* Speed Mode toggle */}
          <button
            onClick={toggleSpeedMode}
            title={t.speedModeDesc}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold
              transition-all duration-200
              ${speedMode
                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700'
                : 'bg-surface-2 text-faint border border-line-strong'}
            `}
          >
            <Zap size={11} className={speedMode ? 'text-violet-500' : ''} />
            {t.speedMode}
          </button>
          <div className="flex items-center gap-1.5 text-xs text-faint font-medium">
            <Clock size={12} />
            <span>{mealTypeLabels[guessMealType()]}</span>
          </div>
        </div>
      </div>

      {/* ── Frequently Logged pills (always visible) ── */}
      {recentFoods.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-faint uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Zap size={11} className="text-yellow-500" />
            {t.frequentlyLogged}
          </p>
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
            {recentFoods.map((food) => (
              <button
                key={food.id}
                onClick={() => handleQuickAdd(food)}
                className="
                  flex-shrink-0 flex items-center gap-2
                  bg-card
                  border border-line
                  hover:border-brand-400 dark:hover:border-brand-600
                  hover:bg-brand-50 dark:hover:bg-brand-900/20
                  rounded-full px-3 py-2
                  shadow-card
                  hover:scale-[1.03] active:scale-[0.97]
                  transition-all duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                "
              >
                <span className="text-xs font-semibold text-muted max-w-[80px] truncate">
                  {food.name}
                </span>
                <span className="text-[10px] font-medium text-faint whitespace-nowrap">
                  {food.calories}kcal
                </span>
                <span className="text-xs font-black text-brand leading-none">＋</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────── */}
      <div role="tablist" className="flex bg-surface-2 rounded-2xl p-1 mb-4">
        {([
          { id: 'photo'  as Tab, label: t.tabPhoto,  icon: Camera },
          { id: 'manual' as Tab, label: t.tabManual, icon: PenLine },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold
              transition-all duration-200
              ${tab === id
                ? 'bg-card text-fg shadow-sm'
                : 'text-faint hover:text-fg'}
            `}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
        {recentFoods.length > 0 && (
          <button
            onClick={() => setTab('recent')}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold
              transition-all duration-200
              ${tab === 'recent'
                ? 'bg-card text-fg shadow-sm'
                : 'text-faint hover:text-fg'}
            `}
          >
            <Clock size={15} />
            {t.tabRecent}
          </button>
        )}
      </div>

      {/* ── Recent tab ──────────────────────────── */}
      {tab === 'recent' && (
        <div className="bg-card rounded-3xl shadow-card border border-line p-4 mb-4">
          <h2 className="text-sm font-bold text-muted mb-3">{t.recentFoods}</h2>
          {recentFoods.length === 0 ? (
            <p className="text-sm text-faint text-center py-4">{t.noRecentFoods}</p>
          ) : (
            <div className="space-y-2">
              {recentFoods.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleQuickAdd(item)}
                  className="
                    w-full flex items-center justify-between p-3.5
                    bg-surface-2
                    hover:bg-brand-50 dark:hover:bg-brand-900/20
                    rounded-2xl transition-all duration-200
                    text-left
                    hover:scale-[1.01] active:scale-[0.99]
                    border border-transparent hover:border-brand-200 dark:hover:border-brand-800
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                  "
                >
                  <div>
                    <p className="text-sm font-bold text-fg">{item.name}</p>
                    <p className="text-xs text-faint mt-0.5">
                      {item.calories}kcal · P{item.protein}g · F{item.fat}g · C{item.carbs}g
                    </p>
                  </div>
                  <span className="text-xl font-black text-brand">＋</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Photo tab ───────────────────────────── */}
      {tab === 'photo' && (
        <div className="bg-card rounded-3xl shadow-card border border-line p-4 mb-4">
          <PhotoUpload onAnalysisComplete={handleAnalysisComplete} />
        </div>
      )}

      {/* ── Entry form ──────────────────────────── */}
      {showForm && (
        <div className="bg-card rounded-3xl shadow-card border border-line p-4 mb-4 space-y-4">
          {tab === 'photo' && (
            <h2 className="text-sm font-bold text-muted">{t.confirmAdd}</h2>
          )}

          {/* Meal type */}
          <div>
            <label className="text-xs font-bold text-faint uppercase tracking-widest block mb-2">
              {t.mealType}
            </label>
            <div className="flex gap-1.5">
              {MEAL_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => updateField('mealType', type)}
                  className={`
                    flex-1 py-2 rounded-xl text-xs font-semibold
                    transition-all duration-200
                    hover:scale-[1.02] active:scale-[0.97]
                    ${form.mealType === type
                      ? 'bg-brand-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]'
                      : 'bg-surface-2 text-muted hover:bg-line'}
                  `}
                >
                  {mealTypeLabels[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Log time */}
          <div>
            <label className="text-xs font-bold text-faint uppercase tracking-widest block mb-2">
              {t.selectLogTime}
            </label>
            <input
              type="time"
              value={logTime}
              onChange={(e) => setLogTime(e.target.value)}
              className="
                w-full px-3 py-2.5 rounded-xl
                border border-line-strong
                bg-surface-2
                text-sm text-fg
                focus:outline-none focus:ring-2 focus:ring-green-400
              "
            />
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-bold text-faint uppercase tracking-widest block mb-2">
              {t.foodName}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="例：鶏むね肉サラダ"
              className={`
                w-full px-3 py-2.5 rounded-xl
                border text-sm
                text-fg
                placeholder:text-faint
                bg-surface-2
                focus:outline-none focus:ring-2 focus:ring-green-400
                ${errors.name ? 'border-red-400' : 'border-line-strong'}
              `}
            />
            {errors.name && <p className="text-xs text-danger mt-1">{errors.name}</p>}
          </div>

          {/* Calories */}
          <div>
            <label className="text-xs font-bold text-faint uppercase tracking-widest block mb-2">
              {t.calories}
            </label>
            <input
              type="number"
              value={form.calories}
              onChange={(e) => updateField('calories', e.target.value)}
              placeholder="0"
              min="0"
              className={`
                w-full px-3 py-2.5 rounded-xl border text-sm
                text-fg
                bg-surface-2
                placeholder:text-faint
                focus:outline-none focus:ring-2 focus:ring-green-400
                ${errors.calories ? 'border-red-400' : 'border-line-strong'}
              `}
            />
            {errors.calories && <p className="text-xs text-danger mt-1">{errors.calories}</p>}
          </div>

          {/* Macros row */}
          <div className="grid grid-cols-3 gap-2.5">
            {(
              [
                { field: 'protein' as const, label: t.proteinG, ring: 'focus:ring-green-400' },
                { field: 'fat'     as const, label: t.fatG,     ring: 'focus:ring-amber-400' },
                { field: 'carbs'   as const, label: t.carbsG,   ring: 'focus:ring-blue-400' },
              ]
            ).map(({ field, label, ring }) => (
              <div key={field}>
                <label className="text-[10px] font-bold text-faint uppercase tracking-wide block mb-1.5">
                  {label}
                </label>
                <input
                  type="number"
                  value={form[field]}
                  onChange={(e) => updateField(field, e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  className={`
                    w-full px-2.5 py-2.5 rounded-xl border text-sm text-center
                    text-fg
                    bg-surface-2
                    placeholder:text-faint
                    focus:outline-none focus:ring-2 ${ring}
                    ${errors[field] ? 'border-red-400' : 'border-line-strong'}
                  `}
                />
                {errors[field] && <p className="text-[10px] text-danger mt-0.5">{errors[field]}</p>}
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            className="
              w-full py-3.5 rounded-2xl font-bold text-sm text-white
              bg-gradient-to-r from-brand-500 to-brand-600
              shadow-[0_4px_14px_rgba(16,185,129,0.4)]
              hover:from-brand-600 hover:to-brand-700
              hover:scale-[1.01] active:scale-[0.98]
              transition-all duration-200
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
            "
          >
            {t.addButton}
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
