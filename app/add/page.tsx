'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, PenLine, Clock } from 'lucide-react';
import { addFoodEntry, getRecentFoods } from '@/lib/storage';
import { FoodEntry } from '@/lib/types';
import PhotoUpload from '@/components/PhotoUpload';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';

type MealType = FoodEntry['mealType'];
type Tab = 'photo' | 'manual' | 'recent';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
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

export default function AddPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('photo');
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const recentFoods = getRecentFoods(6);

  const handleAnalysisComplete = (
    result: { name: string; calories: number; protein: number; fat: number; carbs: number },
    photo: string
  ) => {
    setPhotoDataUrl(photo);
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
    if (!form.name.trim()) newErrors.name = '名前を入力してください';
    if (!form.calories || isNaN(Number(form.calories))) newErrors.calories = '数値を入力してください';
    if (!form.protein || isNaN(Number(form.protein))) newErrors.protein = '数値を入力してください';
    if (!form.fat || isNaN(Number(form.fat))) newErrors.fat = '数値を入力してください';
    if (!form.carbs || isNaN(Number(form.carbs))) newErrors.carbs = '数値を入力してください';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const entry: FoodEntry = {
      id: crypto.randomUUID(),
      date: getTodayDate(),
      mealType: form.mealType,
      name: form.name.trim(),
      calories: Math.round(Number(form.calories)),
      protein: Math.round(Number(form.protein) * 10) / 10,
      fat: Math.round(Number(form.fat) * 10) / 10,
      carbs: Math.round(Number(form.carbs) * 10) / 10,
      photoDataUrl,
      addedAt: new Date().toISOString(),
    };
    addFoodEntry(entry);
    router.push('/');
  };

  const handleQuickAdd = (recent: FoodEntry) => {
    addFoodEntry({
      ...recent,
      id: crypto.randomUUID(),
      date: getTodayDate(),
      mealType: guessMealType(),
      photoDataUrl: undefined,
      addedAt: new Date().toISOString(),
    });
    router.push('/');
  };

  const updateField = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const showForm = tab === 'manual' || (tab === 'photo' && form.name !== '');

  const mealTypeLabels: Record<MealType, string> = {
    breakfast: t.breakfast,
    lunch: t.lunch,
    dinner: t.dinner,
    snack: t.snack,
  };

  return (
    <div className="max-w-md mx-auto pb-24 px-4">
      <div className="pt-6 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t.addMeal}</h1>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock size={12} />
          <span>{mealTypeLabels[guessMealType()]}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-200 rounded-xl p-1 mb-4">
        <button
          onClick={() => setTab('photo')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'photo' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
          }`}
        >
          <Camera size={16} />
          {t.tabPhoto}
        </button>
        <button
          onClick={() => setTab('manual')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'manual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
          }`}
        >
          <PenLine size={16} />
          {t.tabManual}
        </button>
        {recentFoods.length > 0 && (
          <button
            onClick={() => setTab('recent')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'recent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            <Clock size={16} />
            {t.tabRecent}
          </button>
        )}
      </div>

      {/* Recent tab */}
      {tab === 'recent' && (
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t.recentFoods}</h2>
          {recentFoods.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">{t.noRecentFoods}</p>
          ) : (
            <div className="space-y-2">
              {recentFoods.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleQuickAdd(item)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-green-50 rounded-xl transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.calories}kcal · P{item.protein}g · F{item.fat}g · C{item.carbs}g
                    </p>
                  </div>
                  <span className="text-green-500 text-lg">＋</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Photo tab */}
      {tab === 'photo' && (
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <PhotoUpload onAnalysisComplete={handleAnalysisComplete} />
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4 space-y-4">
          {tab === 'photo' && (
            <h2 className="text-sm font-semibold text-gray-700">{t.confirmAdd}</h2>
          )}

          {/* Meal Type */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              {t.mealType}
            </label>
            <div className="flex gap-2">
              {MEAL_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => updateField('mealType', type)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                    form.mealType === type
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {mealTypeLabels[type]}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              {t.foodName}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="例：鶏むね肉サラダ"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 ${
                errors.name ? 'border-red-400' : 'border-gray-200'
              }`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Calories */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              {t.calories}
            </label>
            <input
              type="number"
              value={form.calories}
              onChange={(e) => updateField('calories', e.target.value)}
              placeholder="0"
              min="0"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 ${
                errors.calories ? 'border-red-400' : 'border-gray-200'
              }`}
            />
            {errors.calories && <p className="text-xs text-red-500 mt-1">{errors.calories}</p>}
          </div>

          {/* Macros row */}
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { field: 'protein' as const, label: t.proteinG, color: 'focus:ring-green-400' },
                { field: 'fat' as const, label: t.fatG, color: 'focus:ring-amber-400' },
                { field: 'carbs' as const, label: t.carbsG, color: 'focus:ring-blue-400' },
              ]
            ).map(({ field, label, color }) => (
              <div key={field}>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                  {label}
                </label>
                <input
                  type="number"
                  value={form[field]}
                  onChange={(e) => updateField(field, e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 ${color} ${
                    errors[field] ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
                {errors[field] && <p className="text-xs text-red-500 mt-1">{errors[field]}</p>}
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {t.addButton}
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
