'use client';

/**
 * Doctor-facing health report (期間指定, print-CSS → PDF保存).
 *
 * 100% client-side from localStorage (works for guests). The screen view
 * doubles as the 簡易テキスト表示; 「PDF保存」 = window.print() with
 * @media print rules that print exactly the report body on A4. No PII in the
 * header — 期間 + 作成日 + 匿名 participant label only. Vitals are summary
 * statistics; nothing anywhere interprets or diagnoses.
 */

import { useMemo, useState } from 'react';
import { FileText, Printer } from 'lucide-react';
import { getAppData } from '@/lib/data';
import { getRecentCheckIns } from '@/lib/data/checkin';
import { buildHealthReport, type HealthReport, type ReportRange } from '@/lib/report';
import { jstToday, shiftDate } from '@/lib/streak';
import BottomNav from '@/components/BottomNav';
import { useLanguage } from '@/contexts/LanguageContext';
import { CARD_CLASS as cardCls } from '@/components/ui/Card';

type Period = '1w' | '2w' | '1m' | 'custom';
type SectionKey = 'symptoms' | 'meals' | 'workouts' | 'vitals' | 'weight' | 'wellness';

const ALL_SECTIONS: SectionKey[] = ['symptoms', 'meals', 'workouts', 'vitals', 'weight', 'wellness'];

const CATEGORY_JA: Record<string, string> = {
  strength: '筋トレ', cardio: '有酸素', flexibility: 'ストレッチ', other: 'その他',
};

export default function ReportPage() {
  const { t } = useLanguage();
  const today = jstToday();
  const [period, setPeriod] = useState<Period>('2w');
  const [customFrom, setCustomFrom] = useState(shiftDate(today, -13));
  const [customTo, setCustomTo] = useState(today);
  const [sections, setSections] = useState<Set<SectionKey>>(new Set(ALL_SECTIONS));
  const [report, setReport] = useState<HealthReport | null>(null);

  const range: ReportRange = useMemo(() => {
    switch (period) {
      case '1w': return { from: shiftDate(today, -6), to: today };
      case '2w': return { from: shiftDate(today, -13), to: today };
      case '1m': return { from: shiftDate(today, -29), to: today };
      case 'custom': return {
        from: customFrom <= customTo ? customFrom : customTo,
        to: customFrom <= customTo ? customTo : customFrom,
      };
    }
  }, [period, customFrom, customTo, today]);

  const generate = () => {
    setReport(buildHealthReport(getAppData(), getRecentCheckIns(400), range));
  };

  const toggleSection = (key: SectionKey) => {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const show = (key: SectionKey) => sections.has(key);

  const glucoseCtxLabel = (ctx: string) =>
    ctx === 'fasting' ? t.glucoseFasting : ctx === 'postprandial' ? t.glucosePostprandial : t.glucoseRandom;

  const triggerLabelMap: Record<string, string> = {
    '食事': t.triggerMeal, '運動': t.triggerExercise, 'ストレス': t.triggerStress,
    '天候': t.triggerWeather, '睡眠不足': t.triggerSleep, '不明': t.triggerUnknown,
  };

  const thCls = 'text-left text-[11px] font-bold text-faint uppercase tracking-wide py-1.5 pr-3 border-b border-line';
  const tdCls = 'text-xs text-fg py-1.5 pr-3 border-b border-line align-top tabular-nums';
  const secTitleCls = 'text-sm font-black text-fg border-b-2 border-line-strong pb-1 mb-2';

  const statsRow = (label: string, s: { count: number; min: number; median: number; max: number }, unit: string) => (
    <tr key={label}>
      <td className={tdCls}>{label}</td>
      <td className={tdCls}>{s.count}</td>
      <td className={tdCls}>{s.min}{unit}</td>
      <td className={tdCls}>{s.median}{unit}</td>
      <td className={tdCls}>{s.max}{unit}</td>
    </tr>
  );

  return (
    <div className="max-w-md lg:max-w-2xl mx-auto pb-28 lg:pb-8 px-4 lg:px-6 bg-[var(--background)] min-h-screen">
      {/* Print exactly the report body — everything else hidden on paper. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-report, #print-report * { visibility: visible; }
          #print-report {
            position: absolute; left: 0; top: 0; width: 100%;
            padding: 0; margin: 0;
          }
          #print-report section { break-inside: avoid; }
          @page { size: A4; margin: 18mm 15mm; }
        }
      `}</style>

      {/* ── Header + controls (screen only) ──────────── */}
      <div className="print:hidden">
        <div className="flex items-center gap-2.5 pt-6 pb-5">
          <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-2xl">
            <FileText size={20} className="text-teal-600 dark:text-teal-400" />
          </div>
          <h1 className="text-2xl font-black text-fg tracking-tight">{t.reportTitle}</h1>
        </div>

        <div className={`${cardCls} p-4 mb-4 space-y-3`}>
          {/* Period */}
          <div>
            <span className="block text-xs font-bold text-faint uppercase tracking-widest mb-1.5">{t.reportPeriod}</span>
            <div className="flex gap-1.5" role="radiogroup" aria-label={t.reportPeriod}>
              {([['1w', t.reportPeriod1w], ['2w', t.reportPeriod2w], ['1m', t.reportPeriod1m], ['custom', t.reportPeriodCustom]] as const).map(([value, label]) => (
                <button key={value} type="button" role="radio" aria-checked={period === value}
                  onClick={() => setPeriod(value)}
                  className={`
                    flex-1 px-2 py-2 rounded-xl text-xs font-bold transition-all duration-200
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                    ${period === value
                      ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700'
                      : 'bg-surface-2 text-muted border border-transparent'}
                  `}>
                  {label}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input type="date" value={customFrom} max={today} onChange={(e) => setCustomFrom(e.target.value)}
                  aria-label={`${t.reportPeriod} (from)`}
                  className="px-3 py-2 rounded-xl border border-line-strong bg-surface-2 text-fg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" />
                <input type="date" value={customTo} max={today} onChange={(e) => setCustomTo(e.target.value)}
                  aria-label={`${t.reportPeriod} (to)`}
                  className="px-3 py-2 rounded-xl border border-line-strong bg-surface-2 text-fg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" />
              </div>
            )}
          </div>

          {/* Section include-checkboxes */}
          <div>
            <span className="block text-xs font-bold text-faint uppercase tracking-widest mb-1.5">{t.reportSections}</span>
            <div className="flex gap-1.5 flex-wrap">
              {([
                ['symptoms', t.reportSecSymptoms], ['meals', t.reportSecMeals], ['workouts', t.reportSecWorkouts],
                ['vitals', t.reportSecVitals], ['weight', t.reportSecWeight], ['wellness', t.reportSecWellness],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" aria-pressed={sections.has(key)}
                  onClick={() => toggleSection(key)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border-2 transition-all ${
                    sections.has(key)
                      ? 'border-teal-400 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300'
                      : 'border-line text-faint hover:border-line-strong'
                  }`}>
                  {sections.has(key) ? '✓ ' : ''}{label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={generate}
              className="
                flex-1 py-3 rounded-2xl font-black text-sm text-white
                bg-gradient-to-r from-teal-500 to-cyan-600
                shadow-[0_4px_14px_rgba(20,184,166,0.4)]
                hover:scale-[1.01] active:scale-[0.98] transition-all duration-200
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]
              ">
              {t.reportGenerate}
            </button>
            {report && (
              <button type="button" onClick={() => window.print()}
                className="
                  flex items-center gap-1.5 px-4 py-3 rounded-2xl font-black text-sm
                  bg-surface-2 text-fg border border-line-strong
                  hover:scale-[1.02] active:scale-95 transition-all duration-200
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
                ">
                <Printer size={14} aria-hidden="true" /> {t.reportPrint}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Report body (screen + print) ─────────────── */}
      {report && (
        <div id="print-report" className="bg-card print:bg-transparent rounded-3xl print:rounded-none border border-line print:border-0 shadow-card print:shadow-none p-5 print:p-0 space-y-5 text-fg">
          {/* Header: 期間 + 作成日 + anonymous participant only (no PII) */}
          <header>
            <h2 className="text-lg font-black">{t.reportTitle}</h2>
            <table className="mt-1">
              <tbody>
                <tr>
                  <td className="text-xs text-muted pr-4">{t.reportPeriod}</td>
                  <td className="text-xs font-bold tabular-nums">{report.range.from} 〜 {report.range.to}</td>
                </tr>
                <tr>
                  <td className="text-xs text-muted pr-4">{t.reportGeneratedAt}</td>
                  <td className="text-xs font-bold tabular-nums">{today}</td>
                </tr>
                <tr>
                  <td className="text-xs text-muted pr-4">{t.reportParticipant}</td>
                  <td className="text-xs font-bold">{t.reportAnonymous}</td>
                </tr>
              </tbody>
            </table>
          </header>

          {/* ── Symptoms ── */}
          {show('symptoms') && (
            <section>
              <h3 className={secTitleCls}>{t.reportSecSymptoms}</h3>
              {report.symptoms.rows.length === 0 ? (
                <p className="text-xs text-faint">{t.reportNoData}</p>
              ) : (
                <>
                  {/* Frequency summary */}
                  <p className="text-xs text-muted mb-2">
                    {report.symptoms.countsByName.map((c) => `${c.name}×${c.count}`).join('、')}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={thCls}>日付</th>
                          <th className={thCls}>{t.symptomName}</th>
                          <th className={thCls}>{t.symptomSeverity}</th>
                          <th className={thCls}>持続</th>
                          <th className={thCls}>きっかけ</th>
                          <th className={thCls}>対処</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.symptoms.rows.map((r, i) => (
                          <tr key={i}>
                            <td className={tdCls}>{r.date.slice(5)}</td>
                            <td className={tdCls}>
                              {r.name}
                              {(r.relatedMealName || r.relatedWorkoutName) && (
                                <span className="text-faint"> ({[r.relatedMealName, r.relatedWorkoutName].filter(Boolean).join(' / ')})</span>
                              )}
                            </td>
                            <td className={tdCls}>
                              {r.severity}/10
                              {/* Neutral CSS severity bar — deterministic print, no recharts */}
                              <span aria-hidden="true" className="inline-block ml-1.5 h-1.5 rounded-full bg-fg/60 align-middle" style={{ width: `${r.severity * 4}px` }} />
                            </td>
                            <td className={tdCls}>{r.durationMin != null ? `${r.durationMin}分` : '—'}</td>
                            <td className={tdCls}>{r.trigger ? (triggerLabelMap[r.trigger] ?? r.trigger) : '—'}</td>
                            <td className={tdCls}>{r.actionTaken ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}

          {/* ── Meals ── */}
          {show('meals') && (
            <section>
              <h3 className={secTitleCls}>{t.reportSecMeals}</h3>
              {report.meals.daysLogged === 0 ? (
                <p className="text-xs text-faint">{t.reportNoData}</p>
              ) : (
                <table className="w-full border-collapse">
                  <tbody>
                    <tr>
                      <td className={tdCls}>{t.reportDaysLogged}</td>
                      <td className={tdCls}>{report.meals.daysLogged}日</td>
                    </tr>
                    <tr>
                      <td className={tdCls}>{t.reportAvgPerDay}</td>
                      <td className={tdCls}>
                        {report.meals.avgCalories} kcal · P {report.meals.avgProtein}g · F {report.meals.avgFat}g · C {report.meals.avgCarbs}g
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </section>
          )}

          {/* ── Workouts ── */}
          {show('workouts') && (
            <section>
              <h3 className={secTitleCls}>{t.reportSecWorkouts}</h3>
              {report.workouts.sessions === 0 ? (
                <p className="text-xs text-faint">{t.reportNoData}</p>
              ) : (
                <table className="w-full border-collapse">
                  <tbody>
                    <tr>
                      <td className={tdCls}>{t.reportSessions}</td>
                      <td className={tdCls}>
                        {report.workouts.sessions}
                        <span className="text-faint">
                          {' '}({report.workouts.sessionsByCategory.map((c) => `${CATEGORY_JA[c.category] ?? c.category}×${c.count}`).join('、')})
                        </span>
                      </td>
                    </tr>
                    {report.workouts.totalMinutes > 0 && (
                      <tr>
                        <td className={tdCls}>{t.reportTotalMinutes}</td>
                        <td className={tdCls}>{report.workouts.totalMinutes}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {/* ── Vitals (summary statistics only) ── */}
          {show('vitals') && (
            <section>
              <h3 className={secTitleCls}>{t.reportSecVitals}</h3>
              {!report.vitals.systolic && report.vitals.glucoseByContext.length === 0 ? (
                <p className="text-xs text-faint">{t.reportNoData}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={thCls}></th>
                        <th className={thCls}>{t.reportCount}</th>
                        <th className={thCls}>{t.reportStatMin}</th>
                        <th className={thCls}>{t.reportStatMedian}</th>
                        <th className={thCls}>{t.reportStatMax}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.vitals.systolic && statsRow(t.systolicLabel, report.vitals.systolic, '')}
                      {report.vitals.diastolic && statsRow(t.diastolicLabel, report.vitals.diastolic, '')}
                      {report.vitals.glucoseByContext.map((g) =>
                        statsRow(`${t.glucoseLabel}（${glucoseCtxLabel(g.context)}）`, g.stats, ''),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* ── Weight ── */}
          {show('weight') && (
            <section>
              <h3 className={secTitleCls}>{t.reportSecWeight}</h3>
              {report.weight.series.length === 0 ? (
                <p className="text-xs text-faint">{t.reportNoData}</p>
              ) : (
                <table className="w-full border-collapse">
                  <tbody>
                    <tr>
                      <td className={tdCls}>{t.reportDaysLogged}</td>
                      <td className={tdCls}>
                        {report.weight.series.length}日
                        <span className="text-faint">
                          {' '}({report.weight.series[0].weight}kg → {report.weight.series[report.weight.series.length - 1].weight}kg)
                        </span>
                      </td>
                    </tr>
                    {report.weight.deltaKg != null && (
                      <tr>
                        <td className={tdCls}>{t.reportDelta}</td>
                        <td className={tdCls}>{report.weight.deltaKg > 0 ? '+' : ''}{report.weight.deltaKg} kg</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {/* ── Wellness ── */}
          {show('wellness') && (
            <section>
              <h3 className={secTitleCls}>{t.reportSecWellness}</h3>
              {report.wellness.avgSleepHours == null && report.wellness.avgWaterMl == null ? (
                <p className="text-xs text-faint">{t.reportNoData}</p>
              ) : (
                <table className="w-full border-collapse">
                  <tbody>
                    {report.wellness.avgSleepHours != null && (
                      <tr><td className={tdCls}>{t.sleepLabel}</td><td className={tdCls}>{report.wellness.avgSleepHours} h</td></tr>
                    )}
                    {report.wellness.avgSleepQuality != null && (
                      <tr><td className={tdCls}>{t.sleepQualityLabel}</td><td className={tdCls}>{report.wellness.avgSleepQuality} / 5</td></tr>
                    )}
                    {report.wellness.avgStressLevel != null && (
                      <tr><td className={tdCls}>{t.stressLevelLabel}</td><td className={tdCls}>{report.wellness.avgStressLevel} / 5</td></tr>
                    )}
                    {report.wellness.avgWaterMl != null && (
                      <tr><td className={tdCls}>💧</td><td className={tdCls}>{report.wellness.avgWaterMl} ml/日</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </section>
          )}

          {/* ── Disclaimer footer ── */}
          <footer className="pt-2 border-t border-line">
            <p className="text-[10px] text-faint leading-relaxed">{t.reportDisclaimer}</p>
          </footer>
        </div>
      )}

      <div className="print:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
