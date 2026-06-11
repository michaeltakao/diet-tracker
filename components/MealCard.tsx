'use client';

import { useState } from 'react';
import { Trash2, Pencil, Check, X } from 'lucide-react';
import { FoodEntry } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface MealCardProps {
  entry:    FoodEntry;
  onDelete: (id: string) => void;
  onEdit?:  (updated: FoodEntry) => void;
}

const MEAL_BADGE: Record<FoodEntry['mealType'], { bg: string; text: string }> = {
  breakfast: { bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-400' },
  lunch:     { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  dinner:    { bg: 'bg-blue-100 dark:bg-blue-900/30',     text: 'text-blue-700 dark:text-blue-400' },
  snack:     { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
};

const inputCls = `
  px-2.5 py-1.5 rounded-xl text-xs font-semibold
  border border-gray-200 dark:border-gray-600
  bg-white dark:bg-gray-700
  text-gray-800 dark:text-gray-100
  focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent
  tabular-nums transition-all duration-150
`;

export default function MealCard({ entry, onDelete, onEdit }: MealCardProps) {
  const { t } = useLanguage();
  const badge = MEAL_BADGE[entry.mealType];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(entry);

  const mealLabel: Record<FoodEntry['mealType'], string> = {
    breakfast: t.breakfast,
    lunch:     t.lunch,
    dinner:    t.dinner,
    snack:     t.snack,
  };

  const handleSave = () => {
    const updated: FoodEntry = {
      ...draft,
      calories: Math.max(0, Math.round(Number(draft.calories)    || 0)),
      protein:  Math.max(0, Math.round(Number(draft.protein) * 10) / 10 || 0),
      fat:      Math.max(0, Math.round(Number(draft.fat)     * 10) / 10 || 0),
      carbs:    Math.max(0, Math.round(Number(draft.carbs)   * 10) / 10 || 0),
    };
    onEdit?.(updated);
    setDraft(updated);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(entry);
    setEditing(false);
  };

  // ── Edit mode ───────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="
        bg-white dark:bg-gray-800
        rounded-2xl p-4
        shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]
        border border-green-200 dark:border-green-700
      ">
        {/* Name */}
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
          className={`${inputCls} w-full mb-2 text-sm font-bold`}
          placeholder="食品名"
          autoFocus
        />

        {/* Meal type */}
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mt) => (
            <button
              key={mt}
              onClick={() => setDraft((p) => ({ ...p, mealType: mt }))}
              className={`
                px-2.5 py-1 rounded-full text-[10px] font-bold transition-all duration-150
                ${draft.mealType === mt
                  ? `${MEAL_BADGE[mt].bg} ${MEAL_BADGE[mt].text} ring-1 ring-current`
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'}
              `}
            >
              {mealLabel[mt]}
            </button>
          ))}
        </div>

        {/* Macros grid */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {[
            { label: 'kcal', field: 'calories' as const, color: 'text-gray-700 dark:text-gray-300' },
            { label: 'P(g)', field: 'protein'  as const, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'F(g)', field: 'fat'      as const, color: 'text-amber-600 dark:text-amber-400' },
            { label: 'C(g)', field: 'carbs'    as const, color: 'text-blue-600 dark:text-blue-400' },
          ].map(({ label, field, color }) => (
            <div key={field}>
              <p className={`text-[9px] font-bold mb-1 ${color}`}>{label}</p>
              <input
                type="number"
                min="0"
                value={String(draft[field])}
                onChange={(e) => setDraft((p) => ({ ...p, [field]: e.target.value }))}
                className={`${inputCls} w-full text-center`}
              />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!draft.name.trim()}
            className="
              flex-1 flex items-center justify-center gap-1.5
              py-2 rounded-xl text-xs font-black
              bg-gradient-to-r from-green-500 to-emerald-600 text-white
              hover:from-green-600 hover:to-emerald-700
              disabled:opacity-40 disabled:cursor-not-allowed
              active:scale-95 transition-all duration-150
            "
          >
            <Check size={13} strokeWidth={3} /> 確定
          </button>
          <button
            onClick={handleCancel}
            className="
              flex items-center justify-center gap-1.5
              px-4 py-2 rounded-xl text-xs font-bold
              bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400
              hover:bg-gray-200 dark:hover:bg-gray-600
              active:scale-95 transition-all duration-150
            "
          >
            <X size={13} /> キャンセル
          </button>
        </div>
      </div>
    );
  }

  // ── Display mode ────────────────────────────────────────────────────────────
  return (
    <div className="
      bg-white dark:bg-gray-800
      rounded-2xl p-4
      shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)]
      border border-gray-50 dark:border-gray-700
      flex gap-3 items-start
      transition-all duration-200
    ">
      {entry.photoDataUrl && (
        <img
          src={entry.photoDataUrl}
          alt={entry.name}
          className="w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-sm"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-semibold text-gray-800 dark:text-gray-100 truncate leading-tight">
                {entry.name}
              </p>
              {(entry.photoDataUrl || entry.photo_url) && (
                <span className="text-[9px] font-bold text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0">
                  📷 推定値
                </span>
              )}
            </div>
            <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${badge.bg} ${badge.text}`}>
              {mealLabel[entry.mealType]}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {onEdit && (
              <button
                onClick={() => { setDraft(entry); setEditing(true); }}
                className="
                  p-1.5 rounded-lg
                  text-gray-300 dark:text-gray-600
                  hover:text-blue-500 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20
                  active:scale-95 transition-all duration-200
                "
                aria-label="編集"
              >
                <Pencil size={14} />
              </button>
            )}
            <button
              onClick={() => onDelete(entry.id)}
              className="
                p-1.5 rounded-lg
                text-gray-300 dark:text-gray-600
                hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20
                active:scale-95 transition-all duration-200
              "
              aria-label={t.delete}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2.5">
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
            {entry.calories.toLocaleString()} kcal
          </span>
          <div className="flex gap-2 text-xs">
            <span className="font-medium text-emerald-600 dark:text-emerald-400">P {entry.protein}g</span>
            <span className="font-medium text-amber-600 dark:text-amber-400">F {entry.fat}g</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">C {entry.carbs}g</span>
          </div>
        </div>
      </div>
    </div>
  );
}
