'use client';

import { Trash2, Dumbbell, Heart, Zap, MoreHorizontal, Clock, Repeat } from 'lucide-react';
import { WorkoutEntry } from '@/lib/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface WorkoutCardProps {
  entry: WorkoutEntry;
  onDelete: (id: string) => void;
}

const CATEGORY_COLORS: Record<WorkoutEntry['category'], string> = {
  strength: 'bg-red-100 text-red-700',
  cardio: 'bg-pink-100 text-pink-700',
  flexibility: 'bg-teal-100 text-teal-700',
  other: 'bg-gray-100 text-gray-700',
};

const CATEGORY_ICONS: Record<WorkoutEntry['category'], React.ReactNode> = {
  strength: <Dumbbell size={12} />,
  cardio: <Heart size={12} />,
  flexibility: <Zap size={12} />,
  other: <MoreHorizontal size={12} />,
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
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-800 truncate">{entry.name}</p>
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${color}`}>
            {icon}
            {categoryLabel[entry.category]}
          </span>
        </div>
        <button
          onClick={() => onDelete(entry.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
          aria-label={t.delete}
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-600">
        {entry.sets !== undefined && entry.reps !== undefined && (
          <span className="flex items-center gap-1">
            <Repeat size={12} className="text-gray-400" />
            {entry.sets} sets × {entry.reps} reps
            {entry.weight !== undefined && ` @ ${entry.weight}kg`}
          </span>
        )}
        {entry.duration !== undefined && (
          <span className="flex items-center gap-1">
            <Clock size={12} className="text-gray-400" />
            {entry.duration} min
          </span>
        )}
      </div>

      {entry.notes && (
        <p className="text-xs text-gray-500 mt-2 italic">{entry.notes}</p>
      )}
    </div>
  );
}
