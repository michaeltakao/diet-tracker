'use client';

import { useEffect, useState } from 'react';
import { Scale, Plus, Trash2, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import {
  addWeightEntry, getWeightEntries, removeWeightEntry, getAppData,
} from '@/lib/data';
import { WeightEntry } from '@/lib/types';
import WeightChart from '@/components/WeightChart';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';

function getTodayDate() { return new Date().toISOString().split('T')[0]; }

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
}

export default function WeightPage() {
  const { t } = useLanguage();
  const [entries, setEntries]           = useState<WeightEntry[]>([]);
  const [goalWeight, setGoalWeightState] = useState<number | undefined>();
  const [input, setInput]               = useState('');
  const [showForm, setShowForm]         = useState(false);

  const load = () => {
    setEntries(getWeightEntries(60));
    const data = getAppData();
    setGoalWeightState(data.goals.goalWeight);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = () => {
    const val = parseFloat(input);
    if (isNaN(val) || val <= 0 || val > 300) return;
    addWeightEntry({
      id: crypto.randomUUID(),
      date: getTodayDate(),
      weight: Math.round(val * 10) / 10,
      addedAt: new Date().toISOString(),
    });
    setInput('');
    setShowForm(false);
    load();
  };

  const handleDelete = (id: string) => { removeWeightEntry(id); load(); };

  const todayEntry = entries.find((e) => e.date === getTodayDate());
  const latest     = entries.at(-1);
  const previous   = entries.at(-2);
  const diff       = latest && previous ? +(latest.weight - previous.weight).toFixed(1) : null;
  const toGoal     = latest && goalWeight ? +(latest.weight - goalWeight).toFixed(1) : null;

  const cardCls = 'bg-white dark:bg-gray-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-50 dark:border-gray-700';

  return (
    <div className="max-w-md mx-auto pb-28 px-4 bg-[var(--background)] min-h-screen">
      {/* ── Header ────────────────────────────── */}
      <div className="flex items-center justify-between pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl">
            <Scale size={20} className="text-indigo-500" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            {t.weightLog}
          </h1>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={`
            w-11 h-11 rounded-2xl
            flex items-center justify-center
            font-black text-white
            transition-all duration-200
            hover:scale-[1.04] active:scale-95
            ${showForm
              ? 'bg-gray-400 dark:bg-gray-600'
              : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_4px_12px_rgba(99,102,241,0.4)]'}
          `}
        >
          <Plus size={22} strokeWidth={2.5} className={`transition-transform duration-200 ${showForm ? 'rotate-45' : ''}`} />
        </button>
      </div>

      {/* ── Quick input ───────────────────────── */}
      {showForm && (
        <div className={`${cardCls} p-4 mb-4 animate-slide-in-up`}>
          <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-3">
            {t.bodyWeight}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="60.0"
              step="0.1"
              min="20"
              max="300"
              className="
                flex-1 px-3.5 py-3 rounded-2xl
                border border-gray-200 dark:border-gray-600
                bg-gray-50 dark:bg-gray-700
                text-gray-800 dark:text-gray-100
                text-lg font-bold tabular-nums
                focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
                placeholder-gray-300 dark:placeholder-gray-600
              "
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              className="
                px-5 py-3
                bg-gradient-to-br from-indigo-500 to-purple-600
                text-white font-black rounded-2xl
                shadow-[0_4px_12px_rgba(99,102,241,0.4)]
                hover:scale-[1.03] active:scale-95
                transition-all duration-200
                text-sm
              "
            >
              {t.addButton}
            </button>
          </div>
          {todayEntry && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-medium">
              今日の記録: <span className="font-bold text-indigo-500">{todayEntry.weight} kg</span>（上書きされます）
            </p>
          )}
        </div>
      )}

      {/* ── Stat tiles ────────────────────────── */}
      {latest && (
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          {/* Current weight */}
          <div className={`${cardCls} p-3 col-span-1 text-center`}>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">{t.latestWeight}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tabular-nums leading-tight">{latest.weight}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">kg</p>
          </div>

          {/* Change from previous */}
          <div className={`${cardCls} p-3 col-span-1 text-center`}>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">前回比</p>
            {diff !== null ? (
              <>
                <div className="flex items-center justify-center gap-0.5">
                  {diff < 0
                    ? <TrendingDown size={16} className="text-emerald-500" />
                    : diff > 0
                    ? <TrendingUp size={16} className="text-red-400" />
                    : <Minus size={16} className="text-gray-400" />}
                  <p className={`text-xl font-black tabular-nums leading-tight ${diff < 0 ? 'text-emerald-600 dark:text-emerald-400' : diff > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-500'}`}>
                    {diff > 0 ? '+' : ''}{diff}
                  </p>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">kg</p>
              </>
            ) : (
              <p className="text-sm text-gray-300 dark:text-gray-600 font-medium mt-2">—</p>
            )}
          </div>

          {/* To goal */}
          <div className={`${cardCls} p-3 col-span-1 text-center`}>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">目標まで</p>
            {toGoal !== null ? (
              <>
                <p className={`text-xl font-black tabular-nums leading-tight ${toGoal <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                  {toGoal <= 0 ? '✓' : `${toGoal}`}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">{toGoal > 0 ? 'kg' : '達成！'}</p>
              </>
            ) : (
              <p className="text-sm text-gray-300 dark:text-gray-600 font-medium mt-2">未設定</p>
            )}
          </div>
        </div>
      )}

      {/* ── Chart ─────────────────────────────── */}
      {entries.length > 0 && (
        <div className={`${cardCls} p-4 mb-3`}>
          <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">{t.weightTrend}</h2>
          <WeightChart entries={entries} goalWeight={goalWeight} />
        </div>
      )}

      {/* ── Goal banner ───────────────────────── */}
      {goalWeight && latest && (
        <div className={`
          rounded-3xl p-4 mb-3
          ${latest.weight <= goalWeight
            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-[0_8px_24px_rgba(34,197,94,0.3)]'
            : 'bg-gradient-to-r from-indigo-500 to-purple-600 shadow-[0_8px_24px_rgba(99,102,241,0.25)]'}
        `}>
          <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-1">{t.weightGoal}</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-white tabular-nums">{goalWeight} <span className="text-lg font-medium">kg</span></p>
            {latest.weight <= goalWeight ? (
              <span className="text-white font-black text-lg">🎉 達成！</span>
            ) : (
              <p className="text-right">
                <span className="text-white/70 text-xs font-medium block">あと</span>
                <span className="text-white font-black text-xl tabular-nums">{toGoal} kg</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── History list ──────────────────────── */}
      <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 mt-1">記録履歴</h2>

      {entries.length === 0 ? (
        <div className={`${cardCls} p-10 text-center`}>
          <p className="text-4xl mb-3">⚖️</p>
          <p className="text-sm font-semibold text-gray-400 dark:text-gray-500">{t.noWeight}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...entries].reverse().map((entry, idx) => {
            const prev = [...entries].reverse()[idx + 1];
            const d = prev ? +(entry.weight - prev.weight).toFixed(1) : null;
            const isToday = entry.date === getTodayDate();
            return (
              <div
                key={entry.id}
                className={`
                  ${cardCls} px-4 py-3.5
                  flex items-center justify-between
                  hover:scale-[1.01] active:scale-[0.99]
                  transition-all duration-200
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs flex-shrink-0 ${isToday ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                    {isToday ? '今' : entry.date.slice(8)}
                  </div>
                  <div>
                    <p className="text-base font-black text-gray-900 dark:text-white tabular-nums">
                      {entry.weight} <span className="text-sm font-medium text-gray-400">kg</span>
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">{formatDateShort(entry.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {d !== null && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full tabular-nums ${
                      d < 0
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                        : d > 0
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                    }`}>
                      {d > 0 ? '+' : ''}{d}kg
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-400 active:scale-90 transition-all duration-200"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
