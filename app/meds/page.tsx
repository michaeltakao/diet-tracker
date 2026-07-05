'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Pill, CheckCircle2, Circle, Clock, AlertTriangle, Info } from 'lucide-react';
import { getHealthProfile } from '@/lib/data';
import { getTodayMedLog, markMedTaken, markMedNotTaken, getMedLogHistory } from '@/lib/data/med-log';
import { getMedicationRules, getConditionRules } from '@/lib/medication-rules';
import type { MedicationRule } from '@/lib/medication-rules';
import BottomNav from '@/components/BottomNav';
import { fmtMonthDayDowShortJa, todayStr as getTodayStr } from '@/lib/format-date';
import { useLanguage } from '@/contexts/LanguageContext';

export default function MedsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [medications,      setMedications]      = useState<string[]>([]);
  const [healthConditions, setHealthConditions] = useState<string[]>([]);
  const [takenToday,       setTakenToday]       = useState<string[]>([]);
  const [history,          setHistory]          = useState<{ date: string; takenMeds: string[] }[]>([]);
  const [matchedRules,     setMatchedRules]     = useState<MedicationRule[]>([]);
  const [expandedRule,     setExpandedRule]     = useState<string | null>(null);

  useEffect(() => {
    const profile = getHealthProfile();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only data load on mount
    setMedications(profile.medications ?? []);
    setHealthConditions(profile.healthConditions ?? []);
    const todayLog = getTodayMedLog();
    setTakenToday(todayLog.takenMeds);
    setHistory(getMedLogHistory(7));
    setMatchedRules(getMedicationRules(profile.medications ?? []));
  }, []);

  const toggleMed = (med: string) => {
    if (takenToday.includes(med)) {
      markMedNotTaken(med);
      setTakenToday(prev => prev.filter(m => m !== med));
    } else {
      markMedTaken(med);
      setTakenToday(prev => [...prev, med]);
    }
  };

  const allTaken = medications.length > 0 && medications.every(m => takenToday.includes(m));
  const todayStr = fmtMonthDayDowShortJa(getTodayStr());

  const cardCls = 'bg-card rounded-3xl shadow-card border border-line p-4';

  if (medications.length === 0) {
    return (
      <div className="max-w-md lg:max-w-2xl mx-auto pb-28 lg:pb-8 px-4 lg:px-6 min-h-screen bg-[var(--background)]">
        <div className="flex items-center gap-3 pt-6 pb-5">
          <button
            onClick={() => router.back()}
            aria-label="戻る"
            className="w-11 h-11 rounded-2xl bg-card shadow-card border border-line flex items-center justify-center text-faint hover:text-fg hover:scale-[1.04] active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <h1 className="text-2xl font-black text-fg tracking-tight flex items-center gap-2">
            <Pill size={22} className="text-violet-500" />
            {t.medsTitle}
          </h1>
        </div>
        <div className={`${cardCls} text-center py-10`}>
          <Pill size={40} className="text-faint mx-auto mb-3" />
          <p className="text-sm font-semibold text-faint mb-1">{t.noMedsTitle}</p>
          <p className="text-xs text-faint mb-4">{t.noMedsDesc}</p>
          <button
            onClick={() => router.push('/settings')}
            className="px-5 py-2.5 rounded-2xl text-sm font-bold bg-violet-600 text-white hover:bg-violet-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-violet-500"
          >
            {t.settings}
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="max-w-md lg:max-w-2xl mx-auto pb-28 lg:pb-8 px-4 lg:px-6 min-h-screen bg-[var(--background)]">
      {/* Header */}
      <div className="flex items-center gap-3 pt-6 pb-5">
        <button
          onClick={() => router.back()}
          aria-label="戻る"
          className="w-11 h-11 rounded-2xl bg-card shadow-card border border-line flex items-center justify-center text-faint hover:text-fg hover:scale-[1.04] active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-fg tracking-tight flex items-center gap-2">
            <Pill size={22} className="text-violet-500" />
            {t.medsTitle}
          </h1>
          <p className="text-xs text-faint mt-0.5">{todayStr}</p>
        </div>
      </div>

      {/* Today's checklist */}
      <div className={`${cardCls} mb-3`}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-black text-faint uppercase tracking-widest">
            {t.todayMedCheck}
          </p>
          {allTaken && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full">
              ✓ {t.allTakenLabel}
            </span>
          )}
        </div>

        <div className="space-y-2">
          {medications.map(med => {
            const taken = takenToday.includes(med);
            const rule = matchedRules.find(r =>
              r.keywords.some(kw =>
                med.toLowerCase().includes(kw.toLowerCase()) ||
                kw.toLowerCase().includes(med.toLowerCase()),
              ),
            );

            return (
              <div key={med}>
                <button
                  onClick={() => toggleMed(med)}
                  className={`
                    w-full flex items-center gap-3 p-3 rounded-2xl
                    transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]
                    ${taken
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-surface-2 border border-line-strong hover:bg-line'}
                  `}
                >
                  {taken
                    ? <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                    : <Circle size={20} className="text-faint shrink-0" />
                  }
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-bold ${taken ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted'}`}>
                      {med}
                    </p>
                    {rule?.timingNote && (
                      <p className="text-xs text-faint flex items-center gap-1 mt-0.5">
                        <Clock size={10} />
                        {rule.timingNote}
                      </p>
                    )}
                  </div>
                  {taken && (
                    <span className="text-xs font-semibold text-emerald-500">{t.takenLabel}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Medication interaction details */}
      {matchedRules.length > 0 && (
        <div className={`${cardCls} mb-3`}>
          <p className="text-xs font-black text-faint uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <AlertTriangle size={12} />
            {t.foodExerciseInteraction}
          </p>
          <div className="space-y-2">
            {matchedRules.map(rule => (
              <div key={rule.displayName} className="border border-line rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedRule(expandedRule === rule.displayName ? null : rule.displayName)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-2 transition-colors"
                >
                  <span className="text-xs font-bold text-muted">{rule.displayName}</span>
                  <span className="text-xs text-faint">{expandedRule === rule.displayName ? '▲' : '▼'}</span>
                </button>
                {expandedRule === rule.displayName && (
                  <div className="px-3 pb-3 space-y-2 border-t border-line">
                    {rule.timingNote && (
                      <div className="flex items-start gap-1.5 pt-2">
                        <Clock size={12} className="text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{rule.timingNote}</p>
                      </div>
                    )}
                    {rule.foodInteractions.map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <AlertTriangle size={11} className="text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-muted">{f}</p>
                      </div>
                    ))}
                    {rule.exerciseNotes.map((e, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <Info size={11} className="text-blue-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-muted">{e}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Condition notes */}
      {healthConditions.length > 0 && (
        <div className={`${cardCls} mb-3`}>
          <p className="text-xs font-black text-faint uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Info size={12} />
            {t.conditionGuide}
          </p>
          <div className="space-y-2">
            {getConditionRules(healthConditions).map(rule => (
              <div key={rule.condition} className="border border-line rounded-2xl overflow-hidden">
                <button
                  onClick={() => setExpandedRule(expandedRule === rule.condition ? null : rule.condition)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-2 transition-colors"
                >
                  <span className="text-xs font-bold text-muted">{rule.condition}</span>
                  <span className="text-xs text-faint">{expandedRule === rule.condition ? '▲' : '▼'}</span>
                </button>
                {expandedRule === rule.condition && (
                  <div className="px-3 pb-3 border-t border-line pt-2 space-y-1">
                    {rule.workoutWarnings.map((w, i) => (
                      <div key={`w${i}`} className="flex items-start gap-1.5">
                        <Info size={11} className="text-orange-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-muted">{w}</p>
                      </div>
                    ))}
                    {rule.nutritionWarnings.map((n, i) => (
                      <div key={`n${i}`} className="flex items-start gap-1.5">
                        <AlertTriangle size={11} className="text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-muted">{n}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7-day history */}
      {history.length > 0 && medications.length > 0 && (
        <div className={`${cardCls} mb-3`}>
          <p className="text-xs font-black text-faint uppercase tracking-widest mb-3">
            {t.past7DaysMeds}
          </p>
          <div className="space-y-1.5">
            {history.slice(0, 7).map(entry => {
              const pct = medications.length ? Math.round((entry.takenMeds.length / medications.length) * 100) : 0;
              return (
                <div key={entry.date} className="flex items-center gap-3">
                  <span className="text-xs text-faint w-20 shrink-0">{entry.date}</span>
                  <div className="flex-1 h-2 bg-surface-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-success' : pct > 50 ? 'bg-warning' : 'bg-danger'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold w-10 text-right ${pct === 100 ? 'text-emerald-500' : 'text-faint'}`}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[10px] text-faint text-center pb-2">
        {t.medDisclaimer}
      </p>

      <BottomNav />
    </div>
  );
}
