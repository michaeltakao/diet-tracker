# Security Review

> Last updated: 2026-05-27
> Reviewer: Engineering Team

## Threat Model

**Asset:** User health data (food logs, weight, workout history)
**Threat actors:** Unauthorized third parties, competing services
**Attack surface:** Browser localStorage, unauthenticated API routes, GitHub repository

## Current Security Findings

### CRITICAL

#### [C-001] Unauthenticated AI API Routes
- **Location:** `app/api/coach/route.ts`, `app/api/habit-report/route.ts`, `app/api/analyze-food/route.ts`
- **Risk:** Any actor can POST to these routes and drain the Gemini API quota
- **Impact:** Financial (API cost exhaustion), availability (rate limit hit)
- **Status:** Unmitigated — fix in STEP 8
- **Mitigation Plan:** Add `getServerUser()` check at top of each route handler; return 401 if no session
- **GitHub Issue:** #[TBD]

#### [C-002] GitHub Token Previously Embedded in Remote URL
- **Location:** `.git/config` (now fixed)
- **Risk:** Token `ghp_nfBW...` was in plaintext remote URL
- **Impact:** Anyone with repo access could read the token from git history or config
- **Status:** ✅ FIXED — remote URL cleaned, `gh auth setup-git` configured
- **Action Required:** Revoke old token at [github.com/settings/tokens](https://github.com/settings/tokens)

### HIGH

#### [H-001] base64 Photos in localStorage
- **Location:** `lib/types.ts:FoodEntry.photoDataUrl`
- **Risk:** XSS could exfiltrate all health data + photos via localStorage read
- **Impact:** Data breach (health data is sensitive)
- **Status:** Partially mitigated (Supabase Storage planned in STEP 6)
- **Mitigation Plan:** Move to Supabase Storage with signed URLs; delete photoDataUrl from localStorage

#### [H-002] No Content Security Policy
- **Location:** `next.config.ts` (does not exist yet)
- **Risk:** XSS attack could read localStorage health data
- **Impact:** Data breach
- **Status:** Not implemented
- **Mitigation Plan:** Add CSP headers in `next.config.ts` after auth is stable
- **GitHub Issue:** #[TBD]

### MEDIUM

#### [M-001] No Input Validation on API Routes
- **Location:** All 3 API routes
- **Risk:** Malformed payloads cause unhandled exceptions; prompt injection via report description
- **Impact:** Service disruption, potential prompt injection
- **Status:** Not implemented
- **Mitigation Plan:** Add Zod validation to all routes in STEP 8

#### [M-002] No Rate Limiting
- **Location:** All API routes
- **Risk:** Brute force, DoS, quota exhaustion
- **Status:** Not implemented
- **Mitigation Plan:** Add per-IP rate limiting (5 req/min for AI routes) in STEP 8

#### [M-003] `lang="ja"` Hardcoded in Layout
- **Location:** `app/layout.tsx:53`
- **Risk:** Incorrect HTML language tag for English users (accessibility)
- **Status:** Low priority, fix with ProfileContext in STEP 5

### LOW

#### [L-001] No Error Boundaries
- **Location:** All page components
- **Risk:** Unhandled exception white-screens the app; localStorage data inaccessible
- **Status:** Not implemented
- **Mitigation Plan:** Add `ErrorBoundary` component wrapping each page

#### [L-002] No `HttpOnly` Fallback for Offline Sessions
- **Status:** N/A until auth is implemented

## Security Controls — Post-Migration Target

| Control | Status | Target |
|---|---|---|
| Authentication (Supabase Auth JWT) | ❌ | STEP 5 |
| Route protection (middleware.ts) | ❌ | STEP 5 |
| API auth gates (getServerUser) | ❌ | STEP 8 |
| Input validation (Zod) | ❌ | STEP 8 |
| Rate limiting (per-IP) | ❌ | STEP 8 |
| RLS on all DB tables | ✅ SQL ready | Awaiting Supabase setup |
| Service role key isolation | ✅ | STEP 3 |
| No secrets in source | ✅ | Ongoing |
| CSP headers | ❌ | Post-STEP 8 |
| Error boundaries | ❌ | Any sprint |

## Environment Variable Security Matrix

| Variable | Access | Where Used | Risk if Leaked |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser | Client + Server | Low (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser | Client + Server | Low (RLS protects) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | admin routes | **CRITICAL** — bypasses RLS |
| `GEMINI_API_KEY` | Server only | AI routes | High — quota exhaustion |

**Rule:** Never add `NEXT_PUBLIC_` prefix to `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY`.
