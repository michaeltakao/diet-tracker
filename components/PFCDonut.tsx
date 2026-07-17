'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMounted } from '@/lib/use-mounted';

interface PFCDonutProps {
  protein: number;
  fat: number;
  carbs: number;
  goalProtein: number;
  goalFat: number;
  goalCarbs: number;
}

const COLORS = {
  protein: '#22c55e',
  fat:     '#f59e0b',
  carbs:   '#3b82f6',
  empty:   '#e2e8f0',
};

export default function PFCDonut({ protein, fat, carbs, goalProtein, goalFat, goalCarbs }: PFCDonutProps) {
  const { t } = useLanguage();

  // Prevent recharts ResponsiveContainer from measuring during SSG
  // (getBoundingClientRect returns -1 width/height in jsdom → console warning)
  const mounted = useMounted();
  const totalCalories = Math.round(protein * 4 + fat * 9 + carbs * 4);
  const goalCalories  = Math.round(goalProtein * 4 + goalFat * 9 + goalCarbs * 4);
  const hasData = protein > 0 || fat > 0 || carbs > 0;

  const data = hasData
    ? [
        { name: t.protein, value: protein, color: COLORS.protein },
        { name: t.fat,     value: fat,     color: COLORS.fat },
        { name: t.carbs,   value: carbs,   color: COLORS.carbs },
      ]
    : [{ name: 'Empty', value: 1, color: COLORS.empty }];

  const legendItems = [
    { label: t.protein, value: protein, goal: goalProtein, color: COLORS.protein, text: 'text-brand-600 dark:text-brand-400' },
    { label: t.fat,     value: fat,     goal: goalFat,     color: COLORS.fat,     text: 'text-warning' },
    { label: t.carbs,   value: carbs,   goal: goalCarbs,   color: COLORS.carbs,   text: 'text-blue-600 dark:text-blue-400' },
  ];

  // Server-side placeholder — recharts needs a DOM to measure dimensions
  if (!mounted) {
    return <div style={{ height: 200 }} aria-hidden="true" />;
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className="w-full"
        style={{ height: 200 }}
        role="img"
        aria-label={`${t.macroBreakdown}: ${t.protein} ${protein}g, ${t.fat} ${fat}g, ${t.carbs} ${carbs}g — ${totalCalories} / ${goalCalories} kcal`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={hasData ? 3 : 0}
              dataKey="value"
              labelLine={false}
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={`cell-${i}`} fill={entry.color} />
              ))}
            </Pie>
            {hasData && (
              <Tooltip
                formatter={(value) => [`${value}g`]}
                contentStyle={{
                  borderRadius: 12,
                  border: 'none',
                  boxShadow: '0 8px 30px rgb(0,0,0,0.1)',
                  fontSize: 12,
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>

        {/* Centre label */}
        <div
          className="relative flex flex-col items-center justify-center pointer-events-none"
          style={{ marginTop: -200, height: 200 }}
        >
          {hasData ? (
            <>
              <span className="text-2xl font-black text-fg tabular-nums leading-tight">
                {totalCalories.toLocaleString()}
              </span>
              <span className="text-[11px] text-faint font-medium">
                / {goalCalories.toLocaleString()} kcal
              </span>
            </>
          ) : (
            <span className="text-xs text-faint font-medium">記録なし</span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-1">
        {legendItems.map(({ label, value, goal, color, text }) => (
          <div key={label} className="flex flex-col items-center">
            <div className="flex items-center gap-1 mb-0.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
              <span className="text-[11px] font-medium text-faint">{label}</span>
            </div>
            <span className={`text-xs font-bold ${text} tabular-nums`}>
              {value}g
              <span className="font-normal text-faint"> / {goal}g</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
