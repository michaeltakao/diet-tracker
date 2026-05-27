'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';

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
  fat: '#f59e0b',
  carbs: '#3b82f6',
};


export default function PFCDonut({ protein, fat, carbs, goalProtein, goalFat, goalCarbs }: PFCDonutProps) {
  const { t } = useLanguage();
  const totalCalories = Math.round(protein * 4 + fat * 9 + carbs * 4);
  const goalCalories = Math.round(goalProtein * 4 + goalFat * 9 + goalCarbs * 4);

  const hasData = protein > 0 || fat > 0 || carbs > 0;

  const data = hasData
    ? [
        { name: t.protein, value: protein, color: COLORS.protein },
        { name: t.fat, value: fat, color: COLORS.fat },
        { name: t.carbs, value: carbs, color: COLORS.carbs },
      ]
    : [
        { name: 'Empty', value: 1, color: '#e5e7eb' },
      ];

  return (
    <div className="flex flex-col items-center">
      <div className="w-full" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={85}
              paddingAngle={hasData ? 3 : 0}
              dataKey="value"
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            {hasData && (
              <Tooltip
                formatter={(value) => [`${value}g`]}
                contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        {/* Center label overlay */}
        <div
          className="relative flex flex-col items-center justify-center"
          style={{ marginTop: -200, height: 200, pointerEvents: 'none' }}
        >
          <span className="text-xl font-bold text-gray-800">{totalCalories}</span>
          <span className="text-xs text-gray-500">/ {goalCalories} kcal</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-1">
        {[
          { label: t.protein, value: protein, goal: goalProtein, color: COLORS.protein },
          { label: t.fat, value: fat, goal: goalFat, color: COLORS.fat },
          { label: t.carbs, value: carbs, goal: goalCarbs, color: COLORS.carbs },
        ].map(({ label, value, goal, color }) => (
          <div key={label} className="flex flex-col items-center">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <span className="text-xs font-semibold text-gray-700">{value}g / {goal}g</span>
          </div>
        ))}
      </div>
    </div>
  );
}
