'use client';

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { addWorkoutEntry, removeWorkoutEntry, getWorkoutsForDate } from '@/lib/storage';
import { WorkoutEntry } from '@/lib/types';
import WorkoutCard from '@/components/WorkoutCard';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';

type Category = WorkoutEntry['category'];

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

interface WorkoutForm {
  name: string;
  category: Category;
  sets: string;
  reps: string;
  weight: string;
  duration: string;
  notes: string;
}

const EMPTY_FORM: WorkoutForm = {
  name: '',
  category: 'strength',
  sets: '',
  reps: '',
  weight: '',
  duration: '',
  notes: '',
};

const CATEGORIES: Category[] = ['strength', 'cardio', 'flexibility', 'other'];

export default function WorkoutPage() {
  const { t } = useLanguage();
  const [workouts, setWorkouts] = useState<WorkoutEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<WorkoutForm>(EMPTY_FORM);
  const [nameError, setNameError] = useState('');
  const today = getTodayDate();

  const loadData = () => {
    setWorkouts(getWorkoutsForDate(today));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = (id: string) => {
    removeWorkoutEntry(id);
    loadData();
  };

  const updateField = (field: keyof WorkoutForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'name') setNameError('');
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      setNameError('Workout name is required');
      return;
    }

    const entry: WorkoutEntry = {
      id: crypto.randomUUID(),
      date: today,
      name: form.name.trim(),
      category: form.category,
      sets: form.sets ? Number(form.sets) : undefined,
      reps: form.reps ? Number(form.reps) : undefined,
      weight: form.weight ? Number(form.weight) : undefined,
      duration: form.duration ? Number(form.duration) : undefined,
      notes: form.notes.trim() || undefined,
      addedAt: new Date().toISOString(),
    };

    addWorkoutEntry(entry);
    setForm(EMPTY_FORM);
    setShowForm(false);
    loadData();
  };

  const categoryLabels: Record<Category, string> = {
    strength: t.catStrength,
    cardio: t.catCardio,
    flexibility: t.catFlexibility,
    other: t.catOther,
  };

  return (
    <div className="max-w-md mx-auto pb-24 px-4">
      <div className="flex items-center justify-between pt-6 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">{t.workoutLog} 💪</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
            showForm
              ? 'bg-gray-200 text-gray-700'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? t.cancel : t.addWorkout}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-4 mb-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">{t.addWorkout}</h2>

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              {t.workoutName}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Bench Press"
              className={`w-full px-3 py-2.5 rounded-xl border text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 ${
                nameError ? 'border-red-400' : 'border-gray-200'
              }`}
            />
            {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              {t.category}
            </label>
            <div className="flex gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => updateField('category', cat)}
                  className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                    form.category === cat
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {categoryLabels[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Strength fields */}
          {(form.category === 'strength') && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { field: 'sets' as const, label: t.sets },
                { field: 'reps' as const, label: t.reps },
                { field: 'weight' as const, label: t.weight },
              ].map(({ field, label }) => (
                <div key={field}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                    {label}
                  </label>
                  <input
                    type="number"
                    value={form[field]}
                    onChange={(e) => updateField(field, e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Cardio / flexibility / other: duration */}
          {(form.category === 'cardio' || form.category === 'flexibility' || form.category === 'other') && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
                {t.duration}
              </label>
              <input
                type="number"
                value={form.duration}
                onChange={(e) => updateField('duration', e.target.value)}
                placeholder="0"
                min="0"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1.5">
              {t.notes}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {t.saveWorkout}
          </button>
        </div>
      )}

      {/* Workout list */}
      {workouts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400">
          <p className="text-3xl mb-2">🏋️</p>
          <p className="text-sm font-medium">{t.noWorkouts}</p>
          <p className="text-xs mt-1">{t.addWorkout}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">{t.workoutLog}</h2>
          {workouts.map((entry) => (
            <WorkoutCard key={entry.id} entry={entry} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
