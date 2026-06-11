# Security Patch Report — Phase 1
> Date: 2026-05-28 | Status: APPLIED | Validated: tsc ✓ lint ✓ build ✓

---

## Summary

Added Supabase session authentication to three previously unauthenticated AI API routes.
Any unauthenticated POST request now receives `{"error":"Unauthorized"}` with HTTP 401.
All existing authenticated behavior is unchanged.

---

## Files Modified

| File | Change | Lines Added |
|------|--------|------------|
| `app/api/coach/route.ts` | +import + auth guard | +5 |
| `app/api/analyze-food/route.ts` | +import + auth guard | +5 |
| `app/api/habit-report/route.ts` | +import + auth guard | +5 |

No other files were modified.

---

## Before / After Auth Flow

### Before (all three routes)
```
POST /api/coach           →  no auth check  →  calls Gemini  →  200
POST /api/analyze-food    →  no auth check  →  calls Gemini  →  200
POST /api/habit-report    →  no auth check  →  calls Gemini  →  200
(any caller, no session required)
```

### After (all three routes)
```
POST /api/coach           →  getServerUser()  →  user=null   →  401 {"error":"Unauthorized"}
                                               →  user≠null  →  calls Gemini  →  200

POST /api/analyze-food    →  getServerUser()  →  user=null   →  401 {"error":"Unauthorized"}
                                               →  user≠null  →  calls Gemini  →  200

POST /api/habit-report    →  getServerUser()  →  user=null   →  401 {"error":"Unauthorized"}
                                               →  user≠null  →  calls Gemini  →  200
```

---

## Implementation Details

**Helper used:** `getServerUser()` from `lib/supabase-server.ts` (pre-existing, production-ready)

```typescript
// lib/supabase-server.ts (unchanged — existing helper)
export async function getServerUser() {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;   // never throws — safe to await without try/catch
  }
}
```

**Pattern applied to each route (identical in all three):**
```typescript
import { getServerUser } from '@/lib/supabase-server';

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getServerUser();      // line 1 of handler body
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... existing code unchanged ...
}
```

**Auth check is first** — before the `GEMINI_API_KEY` check. Rationale: do not reveal server misconfiguration state (500) to unauthenticated callers.

**`getServerUser()` uses `supabase.auth.getUser()`** (validates JWT with Supabase Auth server) — not `getSession()` (client-only, spoofable). This is the correct method for server-side authorization.

---

## SSR / Cookies Compatibility

**Status: Fully compatible. No concerns.**

- All three routes use Node.js runtime (no `export const runtime = 'edge'` declaration).
- `getServerUser()` calls `cookies()` from `next/headers` — requires Node.js runtime ✓.
- The `next.config.ts` sets no global runtime override — default is Node.js ✓.

---

## Edge Runtime Discovery (Important)

**`proxy.ts`** (Next.js 16 replacement for `middleware.ts`) runs at **Edge runtime**.

Key finding from `proxy.ts` matcher config:
```javascript
// proxy explicitly EXCLUDES /api/* from its coverage
'/((?!_next/static|_next/image|api|...
//                               ^^^
```

Comment in proxy.ts: *"API routes: /api/* (these handle auth themselves via getServerUser())"*

**This means:**
- The proxy provides auth protection for all page routes (`/`, `/add`, `/log`, etc.)
- API routes are intentionally excluded — expected to self-authenticate
- My patch **completes the intended design** that was described in the codebase but never implemented

**No conflict exists** between proxy's Edge runtime and route handlers' Node.js runtime — they are separate execution contexts.

---

## Guest Mode Behavior Change

**Before patch:** In guest mode (Supabase URL = placeholder), AI routes were callable by anyone.

**After patch:** In guest mode, `getServerUser()` returns `null` (catches connection error to placeholder URL), so AI routes return 401.

**Assessment:** Correct behavior. The AI coach/analyzer features are meaningless without a real user session. There is no valid guest-mode use case for these routes. The guest mode use-case is localStorage-only data entry, not AI features.

---

## Validation Results

| Check | Command | Result |
|-------|---------|--------|
| TypeScript | `tsc --noEmit` | ✓ No errors |
| ESLint | `npm run lint` | ✓ 0 errors, 12 pre-existing warnings (none in changed files) |
| Build | `npm run build` | ✓ All 3 routes compile as dynamic `ƒ` handlers |

Pre-existing lint warnings (`react-hooks/set-state-in-effect`) are in unrelated frontend files. Not introduced by this patch.

---

## Remaining API Security Risks (Post-Patch)

| ID | Risk | Severity | Status |
|----|------|----------|--------|
| H-003 | No input size limit on `analyze-food` (base64 image, unbounded) | HIGH | OPEN |
| H-004 | No per-user rate limiting on AI routes (authenticated user can spam) | HIGH | OPEN |
| H-005 | Error messages in catch blocks include raw error text (`Coach failed: <message>`) | MEDIUM | OPEN |
| H-008 | Weekly dependency audit not yet automated locally (CI covers it) | LOW | PARTIAL |
| H-010 | RLS policies not audited yet | LOW | OPEN |

**H-001 (unauthenticated routes) is now CLOSED.**
