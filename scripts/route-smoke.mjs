// Route smoke test: one synthetic request per AI route against local next dev.
import { writeFileSync } from 'node:fs';
const BASE = process.env.BASE ?? 'http://localhost:3100';
const today = '2026-11-17';
const days = Array.from({ length: 7 }, (_, i) => `2026-11-${String(11 + i).padStart(2, '0')}`);
const bodies = {
  coach: {
    today, todayCalories: 1650, todayProtein: 95, todayFat: 50, todayCarbs: 190,
    calorieGoal: 2000, proteinGoal: 120, fatGoal: 60, carbsGoal: 250,
    waterConsumed: 1200, waterGoal: 2000,
    todayWorkouts: [{ name: 'ベンチプレス', weight: 60, reps: 8, sets: 3 }],
    recentFoodLog: [
      { date: today, time: '07:30', name: '納豆ご飯', calories: 400, mealType: 'breakfast' },
      { date: today, time: '12:30', name: '鶏胸肉のサラダ', calories: 550, mealType: 'lunch' },
      { date: today, time: '22:10', name: 'ポテトチップス', calories: 330, mealType: 'snack' },
    ],
    recentWorkoutLog: [{ date: '2026-11-15', name: 'スクワット', weight: 80 }],
    streak: 5, healthConditions: ['高血圧'], medications: ['ワーファリン'],
  },
  nutritionist: {
    entries: [
      { name: '鮭おにぎり', calories: 200, protein: 6, fat: 2, carbs: 40, sodiumMg: 500 },
      { name: '豚骨ラーメン', calories: 800, protein: 25, fat: 35, carbs: 90, sodiumMg: 3000 },
      { name: 'ヨーグルト', calories: 100, protein: 5, fat: 3, carbs: 12 },
    ],
    goals: { calories: 2000, protein: 120, fat: 60, carbs: 250 },
  },
  'generate-workout': {
    goal: 'hypertrophy', availableEquipment: ['dumbbell', 'bodyweight'], timeAvailableMin: 30,
    targetBodyParts: ['chest', 'arms'], sorenessAreas: ['legs'], energyLevel: 'medium',
    recentMuscleParts: [{ musclePart: 'legs', daysAgo: 1 }],
  },
  'suggest-workout': {
    today, checkIn: { mood: 4, energy: 3, sleepHours: 6.5, sorenessAreas: ['legs'] },
    plannedSession: null, fitnessGoal: 'muscle_gain', targetWeight: 70,
    recentWorkouts: [{ date: '2026-11-15', name: 'スクワット', musclePart: 'legs' }],
    personalRecords: [{ name: 'ベンチプレス', weight: 70, date: '2026-11-01' }],
    location: 'gym', duration: 45, equipment: ['barbell', 'dumbbell', 'machine'],
  },
  'habit-report': {
    daysWithData: 6, totalDays: 7, avgDailyCalories: 1850, calorieGoal: 2000,
    lateNightEatingDays: 3, noBreakfastDays: 2, avgBreakfastHour: 8, workoutDays: 3,
    missedPostWorkoutDays: 1, streak: 6,
    dailySummary: days.map((date, i) => ({
      date, mealCount: i === 0 ? 0 : 3, totalCalories: i === 0 ? 0 : 1800 + i * 20,
      earliestMealHour: i === 0 ? null : 7 + (i % 3), latestMealHour: i === 0 ? null : 20 + (i % 3),
      lateNightMeals: i % 2, workoutCount: i % 2, workoutHours: i % 2 ? [18] : [],
      missedPostWorkoutWindow: i === 3,
    })),
  },
  'weekly-report': {
    startDate: days[0], endDate: days[6], calorieGoal: 2000, proteinGoal: 120, fatGoal: 60,
    carbsGoal: 250, waterGoal: 2000,
    dailyNutrition: days.map((date, i) => ({
      date, calories: 1800 + i * 30, protein: 90 + i * 3, fat: 55, carbs: 220, water: 1500 + i * 100, mealCount: 3,
    })),
    workoutDays: 3, totalWorkouts: 4, weightStart: 72.4, weightEnd: 71.9, streak: 7,
    healthConditions: ['慢性腎臓病'], medications: [],
  },
};
const results = [];
// CKD=1: CKD fluid-neutral re-check (2026-11-17 round 4). Uses '腎臓病', the
// exact chip value the settings UI sends; round 3's '慢性腎臓病' matched no rule.
if (process.env.CKD === '1') {
  bodies.coach.healthConditions = ['腎臓病', '高血圧'];
  bodies['weekly-report'].healthConditions = ['腎臓病'];
  // Round 5 (CKD protein cap): latest body weight → cap 0.8 × 72 ≈ 58 g.
  bodies.coach.weightKg = 72;
  bodies['weekly-report'].weightKg = 72;
}
const only = process.env.ROUTES?.split(","); for (const [route, body] of Object.entries(bodies).filter(([r]) => !only || only.includes(r))) {
  const t0 = performance.now();
  let status = 0, json = null, err = null;
  try {
    const res = await fetch(`${BASE}/api/${route}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    status = res.status;
    json = await res.json().catch(() => null);
  } catch (e) { err = String(e); }
  const ms = Math.round(performance.now() - t0);
  results.push({ route, status, ms, err, json });
  console.log(route, status, ms + 'ms', err ?? '', JSON.stringify(json).slice(0, 200));
}
writeFileSync(process.argv[2], JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), requests: bodies, results }, null, 2));
