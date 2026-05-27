'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, Check, Upload, Trash2, Database, FileJson, FileSpreadsheet } from 'lucide-react';
import { getAppData, updateGoals } from '@/lib/data';
import { DailyGoals } from '@/lib/types';
import {
  getStorageStats, exportDataAsJSON, exportDataAsCSV,
  importFromFile, clearAllData, StorageStats,
} from '@/lib/export';
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
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setStats(getStorageStats());
  }, []);

  const refreshStats = () => setStats(getStorageStats());

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importFromFile(file);
    if (result.success) {
      refreshStats();
      setImportMsg({ ok: true, text: `インポート完了 — ${result.stats.foodCount} 食事 / ${result.stats.workoutCount} ワークアウト / ${result.stats.weightCount} 体重` });
    } else {
      setImportMsg({ ok: false, text: `エラー: ${result.error}` });
    }
    setTimeout(() => setImportMsg(null), 4000);
    e.target.value = '';
  };

  const handleClear = () => {
    if (!clearConfirm) { setClearConfirm(true); return; }
    clearAllData();
    refreshStats();
    setClearConfirm(false);
    setImportMsg({ ok: true, text: 'データをすべて削除しました' });
    setTimeout(() => setImportMsg(null), 3000);
  };

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

      {/* ── Data & Storage ────────────────────── */}
      <div className={`${cardCls} mt-5 mb-3`}>
        <p className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
          <Database size={13} />
          データ管理
        </p>

        {/* Storage stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: '食事', value: stats.foodCount,    icon: '🍽️' },
              { label: 'ワークアウト', value: stats.workoutCount, icon: '💪' },
              { label: '体重', value: stats.weightCount,  icon: '⚖️' },
            ].map(({ label, value, icon }) => (
              <div
                key={label}
                className="bg-gray-50 dark:bg-gray-700/60 rounded-2xl p-2.5 text-center"
              >
                <div className="text-base">{icon}</div>
                <div className="text-lg font-black text-gray-800 dark:text-gray-100 tabular-nums leading-tight">
                  {value}
                </div>
                <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 mt-0.5">
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Storage usage bar */}
        {stats && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">
                使用容量
              </span>
              <span className="text-xs font-black text-gray-600 dark:text-gray-300 tabular-nums">
                {stats.usedKB} KB
              </span>
            </div>
            <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min((stats.usedBytes / (4 * 1024 * 1024)) * 100, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1 text-right">
              最大 4 MB
            </p>
          </div>
        )}

        {/* Export buttons */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => exportDataAsJSON()}
            className="
              flex-1 flex items-center justify-center gap-2
              py-3 rounded-2xl text-xs font-bold
              bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400
              border border-blue-100 dark:border-blue-800
              hover:bg-blue-100 dark:hover:bg-blue-900/50
              hover:scale-[1.02] active:scale-[0.97]
              transition-all duration-200
            "
          >
            <FileJson size={14} />
            JSON バックアップ
          </button>
          <button
            onClick={() => exportDataAsCSV()}
            className="
              flex-1 flex items-center justify-center gap-2
              py-3 rounded-2xl text-xs font-bold
              bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400
              border border-emerald-100 dark:border-emerald-800
              hover:bg-emerald-100 dark:hover:bg-emerald-900/50
              hover:scale-[1.02] active:scale-[0.97]
              transition-all duration-200
            "
          >
            <FileSpreadsheet size={14} />
            CSV エクスポート
          </button>
        </div>

        {/* Import button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="
            w-full flex items-center justify-center gap-2
            py-3 rounded-2xl text-xs font-bold
            bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400
            border border-indigo-100 dark:border-indigo-800
            hover:bg-indigo-100 dark:hover:bg-indigo-900/50
            hover:scale-[1.02] active:scale-[0.97]
            transition-all duration-200
            mb-2
          "
        >
          <Upload size={14} />
          バックアップから復元（JSON）
        </button>

        {/* Import result toast */}
        {importMsg && (
          <div className={`
            text-xs font-semibold px-3 py-2.5 rounded-xl mb-2 animate-slide-in-up
            ${importMsg.ok
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'}
          `}>
            {importMsg.ok ? '✅ ' : '❌ '}{importMsg.text}
          </div>
        )}

        {/* Clear all data */}
        <button
          onClick={handleClear}
          onBlur={() => setClearConfirm(false)}
          className={`
            w-full flex items-center justify-center gap-2
            py-3 rounded-2xl text-xs font-bold
            transition-all duration-200
            hover:scale-[1.02] active:scale-[0.97]
            ${clearConfirm
              ? 'bg-red-500 text-white shadow-[0_4px_12px_rgba(239,68,68,0.4)]'
              : 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 border border-red-100 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/50'}
          `}
        >
          <Trash2 size={14} />
          {clearConfirm ? '本当に削除する？（もう一度タップで確定）' : 'すべてのデータを削除'}
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
