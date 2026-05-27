'use client';

import { useEffect, useState } from 'react';
import { Scale, Plus, Trash2 } from 'lucide-react';
import {
  addWeightEntry,
  getWeightEntries,
  removeWeightEntry,
  getAppData,
} from '@/lib/storage';
import { WeightEntry } from '@/lib/types';
import WeightChart from '@/components/WeightChart';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

export default function WeightPage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [goalWeight, setGoalWeightState] = useState<number | undefined>();
  const [input, setInput] = useState('');
  const [showForm, setShowForm] = useState(false);

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

  const handleDelete = (id: string) => {
    removeWeightEntry(id);
    load();
  };

  const todayEntry = entries.find((e) => e.date === getTodayDate());

  return (
    <div className="max-w-md mx-auto pb-24 px-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-6 pb-4">
        <div className="flex items-center gap-2">
          <Scale size={22} className="text-indigo-500" />
          <h1 className="text-2xl font-bold text-gray-900">{t.weightLog}</h1>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-10 h-10 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl flex items-center justify-center transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Quick add form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
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
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-xl text-sm transition-colors"
            >
              {t.addButton}
            </button>
          </div>
          {todayEntry && (
            <p className="text-xs text-gray-400 mt-2">
              今日の記録: {todayEntry.weight} kg（上書きされます）
            </p>
          )}
        </div>
      )}

      {/* Chart */}
      {entries.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">{t.weightTrend}</h2>
          <WeightChart entries={entries} goalWeight={goalWeight} />
        </div>
      )}

      {/* Goal */}
      {goalWeight && (
        <div className="bg-indigo-50 rounded-2xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">{t.weightGoal}</p>
            <p className="text-2xl font-bold text-indigo-700">{goalWeight} kg</p>
          </div>
          {entries.at(-1) && (
            <div className="text-right">
              <p className="text-xs text-indigo-400">あと</p>
              <p className={`text-xl font-bold ${
                entries.at(-1)!.weight <= goalWeight ? 'text-green-600' : 'text-indigo-600'
              }`}>
                {Math.abs(entries.at(-1)!.weight - goalWeight).toFixed(1)} kg
              </p>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <h2 className="text-sm font-semibold text-gray-700 mb-3">記録履歴</h2>
      {entries.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400">
          <p className="text-3xl mb-2">⚖️</p>
          <p className="text-sm font-medium">{t.noWeight}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...entries].reverse().map((entry) => (
            <div
              key={entry.id}
              className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="text-base font-semibold text-gray-900">{entry.weight} kg</p>
                <p className="text-xs text-gray-400">{entry.date}</p>
              </div>
              <button
                onClick={() => handleDelete(entry.id)}
                className="text-gray-300 hover:text-red-400 transition-colors p-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
