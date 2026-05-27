'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save } from 'lucide-react';
import { getAppData, updateGoals } from '@/lib/storage';
import { DailyGoals } from '@/lib/types';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';

interface GoalForm {
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
  water: string;
  goalWeight: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { t, lang, setLang } = useLanguage();
  const [form, setForm] = useState<GoalForm>({
    calories: '2000',
    protein: '150',
    fat: '60',
    carbs: '200',
    water: '2000',
    goalWeight: '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const data = getAppData();
    setForm({
      calories: String(data.goals.calories),
      protein: String(data.goals.protein),
      fat: String(data.goals.fat),
      carbs: String(data.goals.carbs),
      water: String(data.goals.water ?? 2000),
      goalWeight: data.goals.goalWeight ? String(data.goals.goalWeight) : '',
    });
  }, []);

  const handleSave = () => {
    const goals: DailyGoals = {
      calories: Number(form.calories) || 2000,
      protein: Number(form.protein) || 150,
      fat: Number(form.fat) || 60,
      carbs: Number(form.carbs) || 200,
      water: Number(form.water) || 2000,
      goalWeight: form.goalWeight ? Number(form.goalWeight) : undefined,
    };
    updateGoals(goals);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateField = (field: keyof GoalForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  return (
    <div className="max-w-md mx-auto pb-24 px-4">
      <div className="flex items-center gap-3 pt-6 pb-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-gray-200 transition-colors"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t.settings} ⚙️</h1>
      </div>

      {/* Language */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3">
        <label className="block text-sm font-semibold text-gray-700 mb-3">{t.language}</label>
        <div className="flex gap-2">
          <button
            onClick={() => setLang('ja')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              lang === 'ja' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            🇯🇵 日本語
          </button>
          <button
            onClick={() => setLang('en')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              lang === 'en' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            🇺🇸 English
          </button>
        </div>
      </div>

      {/* Daily Goals */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-3 space-y-4">
        <p className="text-sm font-semibold text-gray-700">{t.dailyGoals}</p>
        {[
          { field: 'calories' as const, label: t.calorieGoal, color: 'focus:ring-green-400' },
          { field: 'protein' as const, label: t.proteinGoal, color: 'focus:ring-green-400' },
          { field: 'fat' as const, label: t.fatGoal, color: 'focus:ring-amber-400' },
          { field: 'carbs' as const, label: t.carbsGoal, color: 'focus:ring-blue-400' },
          { field: 'water' as const, label: t.waterGoal, color: 'focus:ring-blue-400' },
        ].map(({ field, label, color }) => (
          <div key={field}>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              {label}
            </label>
            <input
              type="number"
              value={form[field]}
              onChange={(e) => updateField(field, e.target.value)}
              min="0"
              className={`w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 ${color}`}
            />
          </div>
        ))}
      </div>

      {/* Weight Goal */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-4 space-y-4">
        <p className="text-sm font-semibold text-gray-700">⚖️ {t.weightGoal}</p>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
            {t.weightGoal}
          </label>
          <input
            type="number"
            value={form.goalWeight}
            onChange={(e) => updateField('goalWeight', e.target.value)}
            placeholder="例: 65.0"
            min="20"
            max="300"
            step="0.1"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        className={`w-full font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 ${
          saved ? 'bg-gray-100 text-gray-600' : 'bg-green-500 hover:bg-green-600 text-white'
        }`}
      >
        <Save size={18} />
        {saved ? t.saved : t.saveSettings}
      </button>

      <BottomNav />
    </div>
  );
}
