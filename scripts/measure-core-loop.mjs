// Core-loop friction probe (dt-critic hard metrics).
//
// Usage: node scripts/measure-core-loop.mjs <baseUrl> <outDir> [routes...]
// Needs playwright-core (set PW_CORE=<dir containing node_modules/playwright-core>,
// default: local install) and system Chrome.
//
// Definitions (keep identical across before/after runs):
//   taps  = clicks + field focuses from /dashboard to "saved"; typing excluded.
//   y     = getBoundingClientRect().top + scrollY of the element, CSS px,
//           viewport 390x844 (iPhone 12-class), one meal entry logged.
//   errors= console "error" messages + uncaught page errors per route.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , base = 'http://localhost:3101', outDir = 'measure-out', ...extraRoutes] = process.argv;
mkdirSync(outDir, { recursive: true });
const req = createRequire(join(process.env.PW_CORE ?? process.cwd(), 'noop.js'));
const { chromium } = req('playwright-core');

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP' });
const host = new URL(base).hostname;
await ctx.addCookies([
  { name: 'dt-guest', value: '1', domain: host, path: '/' },
  { name: 'dt-onboarded', value: '1', domain: host, path: '/' },
]);
await ctx.addInitScript(() => {
  if (localStorage.getItem('diet-tracker-onboarding')) return;
  localStorage.setItem('diet-tracker-onboarding', JSON.stringify({
    completedAt: new Date().toISOString(), skipped: false,
    answers: { fitnessGoal: 'fat_loss', birthYear: 1998, sex: 'male', heightCm: 172, weightKg: 70,
      experience: 'beginner', environment: 'home', availableMinutes: 15, defaultedSteps: [] },
  }));
  // Hide the PWA install banner so it cannot cover controls (P0-3 finding).
  localStorage.setItem('pwa-install-dismissed', String(Date.now()));
});

const page = await ctx.newPage();
const errors = {};
let route = 'init';
page.on('console', (m) => { if (m.type() === 'error') (errors[route] ??= []).push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => (errors[route] ??= []).push('pageerror: ' + String(e).slice(0, 200)));

let taps = 0;
const tap = async (locator) => { await locator.first().click(); taps += 1; };
const go = async (path) => { route = path; await page.goto(base + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(600); };

const result = { base, viewport: '390x844', at: new Date().toISOString() };

// ── Meal: dashboard → saved ─────────────────────────────────
await go('/dashboard');
taps = 0;
await tap(page.locator('a[href="/add"]').last()); // FAB
await page.waitForURL('**/add');
route = '/add'; await page.waitForTimeout(600);
const manualTab = page.getByRole('button', { name: /手動入力|Manual/ });
const nameField = page.getByPlaceholder(/例：|e\.g\./).first();
if (!(await nameField.isVisible().catch(() => false))) await tap(manualTab);
await tap(nameField); await nameField.fill('テスト定食');
// Calories = first numeric input with placeholder "0" (servings has an aria-label).
const kcalField = page.locator('input[type="number"][placeholder="0"]:not([aria-label])').first();
await tap(kcalField); await kcalField.fill('650');
const addBtn = page.getByRole('button', { name: /^(追加する|Add)$/ });
await tap(addBtn);
await page.waitForTimeout(800);
if (page.url().endsWith('/add')) {
  // Validation rejected the save: discard the failed click, fill every still-
  // empty required numeric field (each = 1 tap), then save again.
  taps -= 1;
  const empties = page.locator('input[type="number"][placeholder="0"]:not([aria-label])');
  const n = await empties.count();
  let filled = 0;
  for (let i = 0; i < n; i++) {
    const f = empties.nth(i);
    if ((await f.inputValue()) === '') { await tap(f); await f.fill('20'); filled += 1; }
  }
  result.mealRequiredExtraFields = filled;
  await tap(addBtn);
}
await page.waitForTimeout(1000);
result.mealTaps = taps;
result.mealSavedUrl = page.url();
result.mealStored = await page.evaluate(() => (JSON.parse(localStorage.getItem('diet-tracker-v1') ?? '{}').foodEntries ?? []).length);

// ── Dashboard geometry ───────────────────────────────────────
await go('/dashboard');
const yOf = async (re) => page.evaluate((src) => {
  const rx = new RegExp(src);
  const els = [...document.querySelectorAll('h1,h2,h3,p,span,div,button,a')].filter(
    (el) => el.childElementCount === 0 && rx.test(el.textContent ?? ''));
  const el = els[0];
  return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
}, re.source);
result.yCalorieCard = await yOf(/^(残り|⚠️ オーバー|Remaining)$/);
result.yMealList = await yOf(/^(今日の食事|Today's Meals)$/);
result.yWeightInput = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="quick-weight"]');
  return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null;
});
result.pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
result.cardsAboveMealList = await page.evaluate((yMeal) => {
  const cards = [...document.querySelectorAll('.rounded-2xl')].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.height > 40 && r.width > 300 && r.top + window.scrollY < (yMeal ?? 1e9) && !el.closest('nav');
  });
  // only outermost cards
  return cards.filter((c) => !cards.some((o) => o !== c && o.contains(c))).length;
}, result.yMealList);
await page.screenshot({ path: join(outDir, 'dashboard-viewport.png') });
await page.screenshot({ path: join(outDir, 'dashboard-full.png'), fullPage: true });

// ── Weight: dashboard → saved ───────────────────────────────
taps = 0;
const quick = page.locator('[data-testid="quick-weight"] input');
if (await quick.count()) {
  await tap(quick); await quick.fill('69.4');
  await tap(page.locator('[data-testid="quick-weight"] button[type="submit"], [data-testid="quick-weight"] button').last());
} else {
  await tap(page.locator('nav a[href="/weight"]:visible'));
  await page.waitForURL('**/weight'); route = '/weight'; await page.waitForTimeout(600);
  const inp = page.locator('input[type="number"][aria-label]').first();
  if (!(await inp.isVisible().catch(() => false))) {
    await tap(page.locator('button[aria-expanded]').first()); // open the entry form
  }
  // Count a tap for the field only when autoFocus did not already focus it.
  const focused = await inp.evaluate((el) => el === document.activeElement).catch(() => false);
  if (focused) await inp.fill('69.4'); else { await tap(inp); await inp.fill('69.4'); }
  await tap(inp.locator('xpath=following-sibling::button[1]'));
}
await page.waitForTimeout(800);
result.weightTaps = taps;
result.weightStored = await page.evaluate(() => {
  const raw = localStorage.getItem('diet-tracker-v1');
  if (!raw) return null;
  const d = JSON.parse(raw);
  return (d.weightEntries ?? d.weights ?? []).length;
});

// ── Every route: console errors + screenshot ─────────────────
const routes = ['/dashboard', '/add', '/log', '/workout', '/weight', '/settings', '/research', ...extraRoutes];
for (const r of routes) {
  await go(r);
  await page.screenshot({ path: join(outDir, `route${r.replaceAll('/', '_')}.png`) });
}
result.routes = routes;
result.consoleErrors = errors;

writeFileSync(join(outDir, 'metrics.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
