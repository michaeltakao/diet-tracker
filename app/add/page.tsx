'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, PenLine, Clock, Zap, BookmarkPlus, Heart } from 'lucide-react';
import { addFoodEntry, getRecentFoods, getHealthProfile, getFavoriteFoods } from '@/lib/data';
import { scaleFood } from '@/lib/food-scaling';
import { FoodEntryForm, type FoodFormData } from '@/components/FoodEntryForm';
import { MealTemplateSheet } from '@/components/MealTemplateSheet';
import { FoodEntry, FavoriteFood, MealTemplate } from '@/lib/types';
import PhotoUpload from '@/components/PhotoUpload';
import BottomNav from '@/components/BottomNav';
import { Toast } from '@/components/ui/Toast';
import MedWarning from '@/components/MedWarning';
import { getNutritionWarnings } from '@/lib/medication-rules';
import { useLanguage } from '@/contexts/LanguageContext';

type MealType = FoodEntry['mealType'];
type Tab = 'photo' | 'manual' | 'recent';

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

type FormData = FoodFormData;

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
  const [servings, setServings]             = useState(1);
  const [sourceIsAi, setSourceIsAi]         = useState(false);
  const [favorites, setFavorites]           = useState<FavoriteFood[]>([]);
  const [showTemplates, setShowTemplates]   = useState(false);
  const [templateToast, setTemplateToast]   = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    setRecentFoods(getRecentFoods(6));
    const profile = getHealthProfile();
    setNutritionWarnings(getNutritionWarnings(profile.healthConditions, profile.medications ?? []));
    setSpeedMode(localStorage.getItem(SPEED_MODE_KEY) === 'true');
    setFavorites(getFavoriteFoods());
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
    setSourceIsAi(true);
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

  const changeServings = (next: number) => {
    if (next === servings) return;
    setForm((prev) => {
      const nums = [prev.calories, prev.protein, prev.fat, prev.carbs].map(Number);
      if (nums.some((v) => !Number.isFinite(v)) || nums.every((v) => v === 0)) return prev;
      const scaled = scaleFood(
        { calories: nums[0], protein: nums[1], fat: nums[2], carbs: nums[3] },
        next / servings,
      );
      return {
        ...prev,
        calories: String(scaled.calories),
        protein: String(scaled.protein),
        fat: String(scaled.fat),
        carbs: String(scaled.carbs),
      };
    });
    setServings(next);
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
      servings,
      source: sourceIsAi ? 'ai' : 'manual',
    };
    void addFoodEntry(entry);
    if (speedMode) {
      setForm({ ...EMPTY_FORM, mealType: form.mealType });
      setPhotoDataUrl(undefined);
      setServings(1);
      setSourceIsAi(false);
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

  const handleFavoriteAdd = (fav: FavoriteFood) => {
    void addFoodEntry({
      id: crypto.randomUUID(),
      date: getTodayDate(),
      mealType: guessMealType(),
      name: fav.name,
      calories: fav.calories,
      protein: fav.protein,
      fat: fav.fat,
      carbs: fav.carbs,
      addedAt: buildTimestamp(getTodayDate(), getCurrentTime()),
      source: 'db',
      sourceId: fav.sourceId ?? `favorite:${fav.id}`,
    });
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
      {/* Quick-add / speed-mode success toast */}
      <Toast message={quickAddToast || speedToast ? `✓ ${t.quickAddSuccess}` : templateToast ? `✓ ${t.templateLoggedToast}` : null} />

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
          {/* Saved meals (templates) */}
          <button
            onClick={() => setShowTemplates(true)}
            title={t.mealTemplatesLabel}
            aria-label={t.mealTemplatesLabel}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-surface-2 text-faint border border-line-strong transition-all duration-200 hover:text-fg"
          >
            <BookmarkPlus size={11} aria-hidden />
          </button>
          {/* Speed Mode toggle */}
          <button
            onClick={toggleSpeedMode}
            title={t.speedModeDesc}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold
              transition-all duration-200
              ${speedMode
                ? 'bg-ai-soft text-ai border border-ai/30'
                : 'bg-surface-2 text-faint border border-line-strong'}
            `}
          >
            <Zap size={11} className={speedMode ? 'text-ai' : ''} />
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

      {/* ── Favorites pills ─────────────────────── */}
      {favorites.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-faint uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Heart size={11} className="text-pink-500 fill-current" aria-hidden />
            {t.favoritesLabel}
          </p>
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
            {favorites.map((fav) => (
              <button
                key={fav.id}
                onClick={() => handleFavoriteAdd(fav)}
                className="
                  flex-shrink-0 flex items-center gap-2
                  bg-card
                  border border-line
                  hover:border-pink-300 dark:hover:border-pink-700
                  rounded-full px-3 py-2
                  shadow-card
                  hover:scale-[1.03] active:scale-[0.97]
                  transition-all duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                "
              >
                <span className="text-xs font-semibold text-muted max-w-[80px] truncate">
                  {fav.name}
                </span>
                <span className="text-[10px] font-medium text-faint whitespace-nowrap">
                  {fav.calories}kcal
                </span>
                <span className="text-xs font-black text-brand leading-none">＋</span>
              </button>
            ))}
          </div>
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
        <FoodEntryForm
          form={form}
          errors={errors}
          logTime={logTime}
          servings={servings}
          mealTypeLabels={mealTypeLabels}
          showConfirmHeading={tab === 'photo'}
          t={t}
          onUpdateField={updateField}
          onLogTimeChange={setLogTime}
          onServingsChange={changeServings}
          onSubmit={handleSubmit}
        />
      )}

      {/* ── Saved meals sheet ───────────────────── */}
      <MealTemplateSheet
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onLogged={(_tmpl: MealTemplate) => {
          setTemplateToast(true);
          setTimeout(() => setTemplateToast(false), 1500);
        }}
      />

      <BottomNav />
    </div>
  );
}
