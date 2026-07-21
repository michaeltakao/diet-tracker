'use client';

import { Check, Utensils, Dumbbell, Droplet, Scale, Sparkles } from 'lucide-react';
import type { Quest, QuestType } from '@/lib/daily-quests';
import { useLanguage } from '@/contexts/LanguageContext';

interface DailyQuestsProps {
  quests: Quest[];
}

const QUEST_ICON: Record<QuestType, React.ComponentType<{ size?: number; className?: string }>> = {
  meal: Utensils,
  workout: Dumbbell,
  water: Droplet,
  weight: Scale,
  all_complete: Sparkles,
};

const QUEST_NAME_KEY: Record<QuestType, string> = {
  meal: 'questMealName',
  workout: 'questWorkoutName',
  water: 'questWaterName',
  weight: 'questWeightName',
  all_complete: 'questAllCompleteName',
};

export default function DailyQuests({ quests }: DailyQuestsProps) {
  const { t } = useLanguage();
  const completedCount = quests.filter((q) => q.type !== 'all_complete' && q.completed).length;
  const baseCount = quests.filter((q) => q.type !== 'all_complete').length;

  return (
    <div>
      <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-[var(--sys-text-muted)]">
        {t.questSummary
          .replace('{n}', String(completedCount))
          .replace('{total}', String(baseCount))}
      </p>
      <div className="space-y-2">
        {quests.map((quest) => {
          const Icon = QUEST_ICON[quest.type];
          const name = t[QUEST_NAME_KEY[quest.type] as keyof typeof t] as string;

          return (
            <div
              key={quest.type}
              className="system-panel relative overflow-hidden flex items-center gap-3 rounded-xl px-3.5 py-2.5"
            >
              {!quest.completed && (
                <div className="system-scanline-overlay pointer-events-none absolute inset-0" aria-hidden="true" />
              )}
              <div
                className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  quest.completed ? 'neon-glow' : 'system-border'
                }`}
                style={{ background: 'var(--sys-surface-2)' }}
              >
                {quest.completed ? (
                  <Check size={16} className="text-[var(--sys-primary)]" aria-hidden="true" />
                ) : (
                  <Icon size={16} className="text-[var(--sys-text-muted)]" aria-hidden="true" />
                )}
              </div>
              <div className="relative z-10 flex-1 min-w-0">
                <p
                  className={`text-sm font-bold ${quest.completed ? 'line-through text-[var(--sys-text-muted)]' : 'text-[var(--sys-text)]'}`}
                >
                  {name}
                </p>
              </div>
              <div className="relative z-10 shrink-0">
                {quest.completed ? (
                  <span className="neon-text text-[11px] font-black">{t.questCompleted}</span>
                ) : (
                  <span className="text-[11px] font-bold text-[var(--sys-text-muted)]">
                    {t.questXpEarned.replace('{n}', String(quest.xp))}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
