'use client';

import { Trash2, Dumbbell, Heart, Zap, MoreHorizontal, Clock, Repeat } from 'lucide-react';
import { WorkoutEntry } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface WorkoutCardProps {
  entry: WorkoutEntry;
  onDelete: (id: string) => void;
}

const CATEGORY_COLORS: Record<WorkoutEntry['category'], string> = {
  strength:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cardio:      'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  flexibility: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  other:       'bg-surface-2 text-muted',
};

const CATEGORY_ICONS: Record<WorkoutEntry['category'], React.ReactNode> = {
  strength: <Dumbbell size={12} aria-hidden="true" />,
  cardio: <Heart size={12} aria-hidden="true" />,
  flexibility: <Zap size={12} aria-hidden="true" />,
  other: <MoreHorizontal size={12} aria-hidden="true" />,
};

export default function WorkoutCard({ entry, onDelete }: WorkoutCardProps) {
  const { t } = useLanguage();

  const categoryLabel: Record<WorkoutEntry['category'], string> = {
    strength: t.catStrength,
    cardio: t.catCardio,
    flexibility: t.catFlexibility,
    other: t.catOther,
  };

  const color = CATEGORY_COLORS[entry.category];
  const icon = CATEGORY_ICONS[entry.category];

  return (
    <div className="bg-card rounded-2xl shadow-card border border-line p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-fg truncate">{entry.name}</p>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${color}`}>
            {icon}
            {categoryLabel[entry.category]}
          </span>
        </div>
        <button
          onClick={() => onDelete(entry.id)}
          className="
            p-2 text-faint hover:text-danger hover:bg-red-50 dark:hover:bg-red-900/20
            rounded-lg transition-colors flex-shrink-0
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
          "
          aria-label={`${entry.name}を${t.delete}`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted">
        {entry.sets !== undefined && entry.reps !== undefined && (
          <span className="flex items-center gap-1">
            <Repeat size={12} className="text-faint" aria-hidden="true" />
            {entry.sets} sets × {entry.reps} reps
            {entry.weight !== undefined && ` @ ${entry.weight}kg`}
          </span>
        )}
        {entry.duration !== undefined && (
          <span className="flex items-center gap-1">
            <Clock size={12} className="text-faint" aria-hidden="true" />
            {entry.duration} min
          </span>
        )}
      </div>

      {entry.notes && (
        <p className="text-xs text-faint mt-2 italic">{entry.notes}</p>
      )}
    </div>
  );
}
