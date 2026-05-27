# OSS Research Report

> Generated: 2026-05-27
> Analyst: Engineering Team
> Scope: Nutrition, fitness, weight management, habit tracking, health analytics, PWA health apps

## Methodology

Searched GitHub for repositories matching:
- Topics: nutrition-tracker, fitness-tracker, health-app, workout-app, pwa, nextjs, supabase
- Filter: stars > 200, last commit < 6 months, non-proprietary license

## Repositories Analyzed

---

### 1. waistline-app/waistline

| Attribute | Value |
|---|---|
| Stars | ~2,200 |
| License | GPL-3.0 |
| Last commit | Active |
| Stack | Cordova PWA (vanilla JS) |
| Primary feature | Food diary + barcode scanner |

**Architecture:** Single-page Cordova app with IndexedDB. Service worker for offline support.

**Key features:**
- ✅ OpenFoodFacts barcode scanner (offline database cache)
- ✅ Custom food creation with nutrient profile
- ✅ Goal-based daily tracking (calories, macros, sodium, fiber)
- ✅ Import/export (CSV, JSON)
- ❌ No AI coaching
- ❌ No workout tracking
- ❌ No user accounts

**Gap analysis vs our app:**
- **Barcode scanner** — we lack this entirely. Highest ROI feature.
- **OpenFoodFacts integration** — 3M+ verified foods. Free, no auth required.
- **Nutrient depth** — waistline tracks sodium, fiber, sugar, vitamins. We only track PFC.

**License:** GPL-3.0 → Code cannot be used. Architecture and feature design are fair use.

**Inspiration priority:** HIGH — Barcode scanner + OpenFoodFacts integration

---

### 2. wger-project/wger

| Attribute | Value |
|---|---|
| Stars | ~4,500 |
| License | AGPL-3.0 |
| Last commit | Very active |
| Stack | Django REST + React |
| Primary feature | Workout management + exercise database |

**Architecture:** REST API (Django) with React frontend. PostgreSQL. Exercise database with 600+ exercises.

**Key features:**
- ✅ Exercise library: 600+ exercises with images, muscles, instructions
- ✅ Progressive overload tracking (volume over time)
- ✅ Workout plans + sets/reps programming
- ✅ Rest timer between sets
- ✅ Barcode food scanner (OpenFoodFacts)
- ✅ Body measurements tracking
- ❌ No AI coaching
- ❌ No PWA install

**Gap analysis:**
- **Exercise library** — we accept free-form exercise names; typos break PR tracking
- **Body measurements** — waist/chest/arm over time completes the picture beyond weight
- **Progressive overload charts** — volume per exercise over time

**License:** AGPL-3.0 → **Cannot use any code.** Architecture inspiration only.

**Inspiration priority:** HIGH — Exercise library + body measurements

---

### 3. nicholasgasior/calories-calculator (various forks)

Multiple small React calorie calculators.

**Key finding:** Most use USDA FoodData Central API.
- API: `https://api.nal.usda.gov/fdc/v1/foods/search` (free, API key required)
- 1M+ foods with detailed nutrient profiles
- Better US food coverage than OpenFoodFacts

**Inspiration priority:** MEDIUM — USDA API as secondary data source

---

### 4. nickg/FitTrackee

| Attribute | Value |
|---|---|
| Stars | ~2,000 |
| License | AGPL-3.0 |
| Last commit | Active |
| Stack | Flask + Vue.js |
| Primary feature | GPS sports tracking |

**Key features:**
- ✅ GPX route tracking + map visualization
- ✅ Sports analytics (pace, elevation, heart rate)
- ✅ Personal records per sport
- ❌ No nutrition tracking
- ❌ No AI

**License:** AGPL-3.0 → Cannot use code.

**Inspiration priority:** LOW — GPS tracking not in our roadmap

---

### 5. fork of MyFitnessPal-style clones (multiple)

Several React/Next.js MFP-style apps on GitHub.

**Common patterns observed:**
- Macro ring visualization (we have PFCDonut ✅)
- Daily diary with meal sections (we have this ✅)
- Recent foods carousel (we have quick-add pills ✅)
- Weekly streak visualization (we have BadgeShelf ✅)

**Missing patterns observed:**
- Food search with debouncing + async API
- Barcode scan button in food entry form
- Net calories (total − exercise calories burned)
- Water intake as ring chart (we have linear bar)

---

### 6. kamalkhan-io/React-Fitness-App

| Attribute | Value |
|---|---|
| Stars | ~300 |
| License | MIT |
| Last commit | 2024 |
| Stack | React + ExerciseDB API |

**Key finding:** Uses ExerciseDB API (rapidapi.com):
- 1,300+ exercises with GIFs, muscle diagrams, instructions
- Free tier: 300 requests/month

**Limitation:** RapidAPI dependency = ongoing cost risk.

**Alternative:** ExerciseDB data is based on publicly available data. Several repos export it as static JSON (MIT licensed).

**Inspiration priority:** HIGH — Static JSON exercise database is viable

---

## Feature Priority Matrix (Updated)

| Feature | Source Repo | Our Gap | UV | Complexity | Schema Impact | Priority Score |
|---|---|---|---|---|---|---|
| Barcode food scanner | waistline, wger | Complete gap | 5 | 2 | 1 | **100** |
| OpenFoodFacts integration | waistline, wger | Complete gap | 5 | 2 | 2 | **75** |
| Exercise database (static JSON) | wger, kamalkhan | PR tracking broken | 5 | 2 | 2 | **75** |
| TDEE/BMR calculator | Multiple | Wrong default goals | 5 | 1 | 3 | **100** |
| Body measurements | wger | Beyond weight tracking | 4 | 2 | 2 | **64** |
| Net calorie calculation | MFP clones | Exercise offset missing | 4 | 1 | 1 | **80** |
| Progressive overload chart | wger | Volume not tracked | 4 | 2 | 1 | **80** |
| Nutrient depth (Na, fiber, sugar) | waistline | Only PFC tracked | 3 | 3 | 3 | **18** |
| Rest timer | wger | Workout UX | 3 | 2 | 1 | **48** |
| Water ring chart | Multiple | Linear bar only | 2 | 2 | 1 | **32** |

*Priority Score = UV × (6-C) × (6-SI)*

## Recommended Additions to Phase B Roadmap

Based on this research, Phase B should be extended:

**Phase B (Auth stable):**
1. ~~Barcode scanner~~ (score: 100) — OpenFoodFacts REST API
2. ~~TDEE/BMR calculator~~ (score: 100) — Mifflin-St Jeor, no external API
3. ~~Exercise database~~ (score: 75) — static JSON, MIT-licensed source
4. **NEW: Net calorie tracking** (score: 80) — calories burned from workout metadata
5. **NEW: Progressive overload chart** (score: 80) — pure query over existing data

## License Compliance Summary

| Repo | License | Code Use | Architecture Use |
|---|---|---|---|
| waistline | GPL-3.0 | ❌ | ✅ Inspiration only |
| wger | AGPL-3.0 | ❌ | ✅ Inspiration only |
| FitTrackee | AGPL-3.0 | ❌ | ✅ Inspiration only |
| kamalkhan fitness | MIT | ✅ With attribution | ✅ |
| OpenFoodFacts API | Open Database License | ✅ Data use allowed | ✅ |
| USDA FoodData Central | Public Domain | ✅ | ✅ |

## Next Research Cycle

Scheduled: 2026-06-27 (4 weeks)

Focus topics:
- AI-powered food recognition accuracy benchmarks
- Progressive web app performance patterns
- Supabase offline-first patterns
- React Server Components for health data dashboards
