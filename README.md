# Diet Tracker

A mobile-first diet tracker that logs daily Protein/Fat/Carbs + Calories, with AI-powered photo-based meal analysis via Claude.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Add your Anthropic API key to `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- **Today's Summary** — calorie progress bar, PFC donut chart, macro bars, meal list grouped by type
- **Weekly Log** — 7-day week view with date selector, per-day calorie overview
- **Add Meal** — Photo tab (AI analysis via Claude) or Manual tab for direct entry
- **Workout Log** — strength, cardio, flexibility, and other exercise logging
- **Goals Settings** — configurable daily calorie and macro targets

## Tech Stack

- Next.js 14 (App Router)
- TypeScript (strict)
- Tailwind CSS
- Recharts (donut chart)
- Claude claude-haiku-4-5-20251001 (vision food photo analysis)
- localStorage for persistence (no backend database needed)
