'use client';

/**
 * Manual/confirm food-entry form, extracted from app/add/page.tsx, plus the
 * portion (servings) stepper. Fully controlled: the parent owns form state;
 * the stepper reports the chosen multiplier via onServingsChange and the
 * parent rescales the numeric fields (lib/food-scaling.ts).
 */

import type { FoodEntry } from '@/lib/types';
import type { Translations } from '@/lib/i18n';

type MealType = FoodEntry['mealType'];

export interface FoodFormData {
  name: string;
  mealType: MealType;
  calories: string;
  protein: string;
  fat: string;
  carbs: string;
}

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const SERVING_CHIPS = [0.5, 1, 1.5, 2] as const;

interface FoodEntryFormProps {
  form: FoodFormData;
  errors: Partial<FoodFormData>;
  logTime: string;
  servings: number;
  mealTypeLabels: Record<MealType, string>;
  showConfirmHeading: boolean;
  t: Translations;
  onUpdateField: (field: keyof FoodFormData, value: string) => void;
  onLogTimeChange: (value: string) => void;
  onServingsChange: (servings: number) => void;
  onSubmit: () => void;
}

export function FoodEntryForm({
  form,
  errors,
  logTime,
  servings,
  mealTypeLabels,
  showConfirmHeading,
  t,
  onUpdateField,
  onLogTimeChange,
  onServingsChange,
  onSubmit,
}: FoodEntryFormProps) {
  return (
    <div className="bg-card rounded-3xl shadow-card border border-line p-4 mb-4 space-y-4">
      {showConfirmHeading && (
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
              onClick={() => onUpdateField('mealType', type)}
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
          onChange={(e) => onLogTimeChange(e.target.value)}
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
          onChange={(e) => onUpdateField('name', e.target.value)}
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

      {/* Servings stepper */}
      <div>
        <label htmlFor="servings-input" className="text-xs font-bold text-faint uppercase tracking-widest block mb-2">
          {t.servingsLabel}
        </label>
        <div className="flex gap-1.5 items-center">
          {SERVING_CHIPS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onServingsChange(s)}
              aria-pressed={servings === s}
              className={`
                flex-1 py-2 rounded-xl text-xs font-bold tabular-nums
                transition-all duration-200 active:scale-[0.97]
                ${servings === s
                  ? 'bg-brand-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]'
                  : 'bg-surface-2 text-muted hover:bg-line'}
              `}
            >
              {s}×
            </button>
          ))}
          <input
            id="servings-input"
            type="number"
            value={String(servings)}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0) onServingsChange(v);
            }}
            min="0.1"
            max="10"
            step="0.1"
            aria-label={t.servingsLabel}
            className="
              w-16 px-2 py-2 rounded-xl border border-line-strong text-xs text-center
              text-fg bg-surface-2 tabular-nums
              focus:outline-none focus:ring-2 focus:ring-green-400
            "
          />
        </div>
      </div>

      {/* Calories */}
      <div>
        <label className="text-xs font-bold text-faint uppercase tracking-widest block mb-2">
          {t.calories}
        </label>
        <input
          type="number"
          value={form.calories}
          onChange={(e) => onUpdateField('calories', e.target.value)}
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
              onChange={(e) => onUpdateField(field, e.target.value)}
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
        onClick={onSubmit}
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
  );
}
