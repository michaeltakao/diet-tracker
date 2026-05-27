# System Architecture

> Version: 2.0 (Post-Supabase migration plan)
> Last updated: 2026-05-27

## Overview

Diet Tracker is a PWA-first AI-powered nutrition and fitness tracking platform.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CURRENT STATE                             │
│                                                                  │
│  Browser (PWA)                                                   │
│  ────────────────────────────────────────────────────────────   │
│  Next.js App Router (React 19, TypeScript, Tailwind CSS v4)     │
│                                                                  │
│  Pages:          / /add /log /workout /weight /settings          │
│  Components:     12 shared UI components                         │
│  State:          localStorage (diet-tracker-v1)                  │
│  Data Layer:     lib/data/* → lib/storage.ts → localStorage      │
│                                                                  │
│  Server (Vercel Edge / Node)                                     │
│  ─────────────────────────────────────────────────────────────  │
│  API Routes:     /api/analyze-food /api/coach /api/habit-report  │
│  AI:             Google Gemini 2.5 Flash                         │
│  Auth:           ❌ None (planned: Supabase Auth)                │
│                                                                  │
│  External Services                                               │
│  ─────────────────────────────────────────────────────────────  │
│  Gemini API      AI meal analysis + coaching                     │
│  Vercel          Hosting + Edge Network                          │
│  GitHub Actions  CI/CD (tsc + build + lint)                      │
└─────────────────────────────────────────────────────────────────┘
```

## Target Architecture (Post-Migration)

```
┌─────────────────────────────────────────────────────────────────┐
│                      TARGET STATE (Phase A)                      │
│                                                                  │
│  Browser (PWA)                                                   │
│  ────────────────────────────────────────────────────────────   │
│  Next.js App Router                                              │
│  State:   Supabase (online) + localStorage (offline fallback)    │
│  Auth:    Supabase Auth (Google OAuth + Email)                   │
│  Context: ProfileContext, LanguageContext                        │
│                                                                  │
│  Server (Vercel)                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  middleware.ts   Session validation on all protected routes      │
│  API Routes:     Auth-gated, Zod-validated, rate-limited         │
│  Weekly Report:  Cached in weekly_reports table (24h TTL)        │
│                                                                  │
│  Supabase                                                        │
│  ─────────────────────────────────────────────────────────────  │
│  Auth:           JWT sessions via @supabase/ssr cookies          │
│  Database:       PostgreSQL with RLS on all tables               │
│  Storage:        meal-photos bucket (private, 5MB limit)         │
│                                                                  │
│  External Services                                               │
│  ─────────────────────────────────────────────────────────────  │
│  Gemini 2.5 Flash   AI (auth-gated post-STEP 8)                 │
│  OpenFoodFacts      Barcode lookup (Phase B)                     │
└─────────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

| Layer | Path | Responsibility | Depends On |
|---|---|---|---|
| Pages | `app/*/page.tsx` | UI, user interaction | lib/data, contexts |
| API Routes | `app/api/*/route.ts` | Server-side computation, AI calls | lib/supabase-server |
| Data Layer | `lib/data/*` | CRUD abstraction (localStorage→Supabase) | lib/storage OR lib/supabase |
| Storage | `lib/storage.ts` | localStorage read/write | Browser API |
| Supabase Client | `lib/supabase.ts` | Browser Supabase client | @supabase/ssr |
| Supabase Server | `lib/supabase-server.ts` | Server Supabase client + service role | @supabase/ssr, next/headers |
| Types | `lib/types.ts` | Domain types (FoodEntry, WorkoutEntry, etc.) | — |
| DB Types | `lib/database.types.ts` | DB schema mirror | — |
| Components | `components/*` | Reusable UI | lib/types |
| Contexts | `contexts/*` | Global state (language, auth) | lib/supabase |

## Data Flow (Current)

```
User Action → Page Component → lib/data/* → lib/storage.ts → localStorage
```

## Data Flow (Target)

```
User Action → Page Component → lib/data/*
                                    │
                         ┌──────────┴──────────┐
                         ▼                     ▼
                  (authenticated)        (unauthenticated)
                   Supabase DB            localStorage
                         │                     │
                         └──────────┬──────────┘
                                    ▼
                            UI State Update
```

## Key Architectural Decisions

See [ADR Index](../decisions/ADR_INDEX.md) for full rationale.

| Decision | Choice | Alternative Considered |
|---|---|---|
| Routing | Next.js App Router | Pages Router |
| Styling | Tailwind CSS v4 | CSS Modules, styled-components |
| Database | Supabase (PostgreSQL) | PlanetScale, Firebase |
| Auth | Supabase Auth | NextAuth.js, Auth0 |
| AI | Google Gemini 2.5 Flash | OpenAI GPT-4o, Claude |
| State (offline) | localStorage | IndexedDB, SQLite WASM |
| PWA | Manual SW | next-pwa package |
| Icons | lucide-react | heroicons, phosphor |

## Security Model

```
PUBLIC (no auth required):
  /login
  /api/auth/* (Supabase callback)

PROTECTED (session required, enforced by middleware.ts):
  / /add /log /workout /weight /settings
  /api/coach /api/analyze-food /api/habit-report (post-STEP 8)

ADMIN (service role only, never client-accessible):
  /api/admin/*
  weekly_reports upsert
  badge award server-side
```

## Performance Targets

| Metric | Target | Current |
|---|---|---|
| Lighthouse PWA | > 90 | ~85 (estimated) |
| First Contentful Paint | < 1.5s | Unknown |
| TypeScript errors | 0 | ✅ 0 |
| Build time | < 60s | ~40s |
| CI time | < 5min | ~2min |
