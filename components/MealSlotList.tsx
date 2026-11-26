'use client';

/**
 * Today's meals as four fixed slots (UX P0 slice 4, REDESIGN_PROPOSAL §2–3).
 *
 * - Filled slot: one row (✓, kcal) that expands to its MealCards; a ＋ that
 *   opens /add for that slot.
 * - Empty slot: ＋ to /add?meal=…, and — when the slot was eaten on an
 *   earlier day — "log the same" repeats that whole meal in one tap (the
 *   dashboard makes it undoable).
 *
 * Filled slots start collapsed so the whole day fits the first screen.
 */
import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Plus, Check } from 'lucide-react';
import type { FoodEntry } from '@/lib/types';
import { MEAL_SLOTS, type MealSlot, type LastSlotMeal } from '@/lib/meal-slots';
import MealCard from '@/components/MealCard';
import { useLanguage } from '@/contexts/LanguageContext';

const ICON: Record<MealSlot, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };

interface Props {
  grouped: Record<MealSlot, FoodEntry[]>;
  lastMeals: Record<MealSlot, LastSlotMeal | null>;
  onDelete: (id: string) => void;
  onEdit: (updated: FoodEntry) => void;
  onRepeat: (slot: MealSlot) => void;
}

const ROW_BTN = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]';

export function MealSlotList({ grouped, lastMeals, onDelete, onEdit, onRepeat }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState<Set<MealSlot>>(new Set());
  const label: Record<MealSlot, string> = { breakfast: t.breakfast, lunch: t.lunch, dinner: t.dinner, snack: t.snack };

  const toggle = (s: MealSlot) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });

  return (
    <ul className="bg-card rounded-2xl shadow-card border border-line divide-y divide-line mb-3 overflow-hidden" data-testid="meal-slots">
      {MEAL_SLOTS.map((slot) => {
        const items = grouped[slot];
        const kcal = items.reduce((s, e) => s + e.calories, 0);
        const isOpen = open.has(slot);
        const last = lastMeals[slot];
        const addHref = `/add?meal=${slot}`;
        const addLabel = t.slotAdd.replace('{slot}', label[slot]);

        if (items.length > 0) {
          return (
            <li key={slot} data-slot={slot}>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => toggle(slot)}
                  aria-expanded={isOpen}
                  aria-label={(isOpen ? t.slotCollapse : t.slotExpand).replace('{slot}', label[slot])}
                  className={`flex-1 flex items-center gap-2 min-h-12 pl-3 pr-2 text-left hover:bg-surface-2 ${ROW_BTN}`}
                >
                  {isOpen
                    ? <ChevronDown size={14} className="text-faint shrink-0" aria-hidden="true" />
                    : <ChevronRight size={14} className="text-faint shrink-0" aria-hidden="true" />}
                  <span aria-hidden="true" className="shrink-0">{ICON[slot]}</span>
                  <span className="text-sm font-bold text-fg shrink-0 whitespace-nowrap">{label[slot]}</span>
                  <Check size={14} className="text-brand shrink-0" aria-hidden="true" />
                  <span className="text-xs text-faint truncate min-w-0">
                    {items.length === 1 ? items[0].name : t.slotLastMore.replace('{name}', items[0].name).replace('{n}', String(items.length - 1))}
                  </span>
                  <span className="ml-auto text-sm font-bold text-fg tabular-nums shrink-0">{kcal.toLocaleString()} kcal</span>
                </button>
                <Link href={addHref} aria-label={addLabel} className={`min-w-11 min-h-12 flex items-center justify-center text-brand ${ROW_BTN}`}>
                  <Plus size={18} aria-hidden="true" />
                </Link>
              </div>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2">
                  {items.map((entry) => (
                    <MealCard key={entry.id} entry={entry} onDelete={onDelete} onEdit={onEdit} />
                  ))}
                </div>
              )}
            </li>
          );
        }

        return (
          <li key={slot} data-slot={slot} className="flex items-center gap-2 pl-3">
            <span aria-hidden="true" className="shrink-0">{ICON[slot]}</span>
            <div className="flex-1 min-w-0 py-1.5">
              <p className="text-sm font-bold text-muted whitespace-nowrap">{label[slot]}</p>
              {last && (
                <p className="text-[11px] text-faint truncate tabular-nums">
                  {t.slotLast
                    .replace('{kcal}', last.calories.toLocaleString())
                    .replace('{name}', last.entries.length === 1
                      ? last.entries[0].name
                      : t.slotLastMore.replace('{name}', last.entries[0].name).replace('{n}', String(last.entries.length - 1)))}
                </p>
              )}
            </div>
            {last && (
              <button
                type="button"
                onClick={() => onRepeat(slot)}
                data-testid={`repeat-${slot}`}
                className="shrink-0 min-h-11 px-3 rounded-xl text-xs font-black bg-brand-50 dark:bg-brand-900/30 text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                {t.slotSame}
              </button>
            )}
            <Link href={addHref} aria-label={addLabel} className={`shrink-0 min-w-11 min-h-12 flex items-center justify-center text-brand ${ROW_BTN}`}>
              <Plus size={18} aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
