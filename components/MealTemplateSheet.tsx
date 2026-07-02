'use client';

/**
 * Bottom sheet listing saved meal templates for one-tap re-log.
 * Logging a template creates one FoodEntry per item, dated today, stamped
 * source:'db' — values are the template's stored finals (1× portion).
 */

import { useEffect, useState } from 'react';
import { X, Trash2, BookmarkPlus } from 'lucide-react';
import { getMealTemplates, deleteMealTemplate } from '@/lib/data/meal-templates';
import { addFoodEntry } from '@/lib/data';
import { useLanguage } from '@/contexts/LanguageContext';
import type { MealTemplate } from '@/lib/types';

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

interface MealTemplateSheetProps {
  open: boolean;
  onClose: () => void;
  /** Called after a template was logged (e.g. show toast, refresh). */
  onLogged: (tmpl: MealTemplate) => void;
}

export function MealTemplateSheet({ open, onClose, onLogged }: MealTemplateSheetProps) {
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<MealTemplate[]>([]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage read when the sheet opens
    setTemplates(getMealTemplates());
  }, [open]);

  if (!open) return null;

  const totalKcal = (tmpl: MealTemplate) =>
    tmpl.items.reduce((s, i) => s + i.calories, 0);

  const handleLog = (tmpl: MealTemplate) => {
    const now = new Date().toISOString();
    for (const item of tmpl.items) {
      void addFoodEntry({
        id: crypto.randomUUID(),
        date: getTodayDate(),
        mealType: tmpl.mealType,
        name: item.name,
        calories: item.calories,
        protein: item.protein,
        fat: item.fat,
        carbs: item.carbs,
        addedAt: now,
        source: 'db',
        sourceId: `template:${tmpl.id}`,
      });
    }
    onLogged(tmpl);
    onClose();
  };

  const handleDelete = (id: string) => {
    void deleteMealTemplate(id);
    setTemplates(getMealTemplates());
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.mealTemplatesLabel}
        className="w-full max-w-md bg-card rounded-t-3xl shadow-elevated border-t border-line p-4 pb-8 max-h-[70vh] overflow-y-auto animate-slide-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black text-fg flex items-center gap-2">
            <BookmarkPlus size={15} className="text-brand" aria-hidden />
            {t.mealTemplatesLabel}
          </h2>
          <button
            onClick={onClose}
            aria-label={t.cancel}
            className="p-2 rounded-xl text-faint hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {templates.length === 0 ? (
          <p className="text-xs text-faint text-center py-8">{t.noTemplatesMsg}</p>
        ) : (
          <div className="space-y-2">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="flex items-center gap-2 p-3 bg-surface-2 rounded-2xl"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-fg truncate">{tmpl.name}</p>
                  <p className="text-xs text-faint mt-0.5">
                    {tmpl.items.length}品 · {totalKcal(tmpl)} kcal
                  </p>
                </div>
                <button
                  onClick={() => handleLog(tmpl)}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white hover:bg-brand-700 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  {t.logAllLabel}
                </button>
                <button
                  onClick={() => handleDelete(tmpl.id)}
                  aria-label={`${tmpl.name}を${t.delete}`}
                  className="p-2 rounded-xl text-faint hover:text-danger transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
