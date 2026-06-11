# Security Hardening Checklist
> Generated: 2026-05-28 | Status: ACTIVE

---

## CRITICAL (Fix before any public exposure)

### [H-001] Unauthenticated AI API Routes — ✅ CLOSED (2026-05-28)
**Routes:** `app/api/coach/route.ts`, `app/api/analyze-food/route.ts`, `app/api/habit-report/route.ts`
**Fixed:** `getServerUser()` auth guard added as first check in all three routes. tsc ✓ lint ✓ build ✓
**See:** `docs/security/SECURITY_PATCH_REPORT.md`

**Fix pattern** (apply to each route):
```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user || error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ... rest of handler
}
```

**Command for agent:**
```
cc "Add Supabase auth check to all three AI API routes:
app/api/coach/route.ts, app/api/analyze-food/route.ts, app/api/habit-report/route.ts.
Use createServerClient from @supabase/ssr with the cookies() pattern.
Return 401 if no valid session. Do not change any other logic."
```

---

## HIGH (Fix this sprint)

### [H-002] user_id Source Verification
**Risk:** If any route accepts `user_id` from request body instead of session, users can act as each other.

**Check:** Grep for routes that read `user_id` from body:
```bash
grep -rn "body.*user_id\|req.*user_id\|userId.*body" app/api/
```

**Rule:** `user_id` must ALWAYS come from `supabase.auth.getUser()`, never from request body.

---

### [H-003] Input Size Limits — ✅ CLOSED (2026-05-28)
**Risk:** `analyze-food` accepts base64 image — no size limit means possible memory exhaustion.
**Fixed:** `analyze-food/route.ts` checks `imageBase64.length > 4MB` and returns 413 before forwarding to Gemini.
**Note:** Check runs after `request.json()` parse; acceptable for current load, but pre-parse check (`request.text()`) would be more robust if needed later.

---

### [H-004] Rate Limiting on AI Routes — ✅ CLOSED (2026-05-28)
**Risk:** Even with auth, an authenticated user can spam AI endpoints.
**Fixed:** Sliding-window rate limiter (`lib/rate-limit.ts`) applied to all three AI routes:
- `analyze-food`: 10 req/min
- `coach`: 20 req/min
- `habit-report`: 5 req/min (rate limit call was imported but missing — added 2026-05-28)

---

## MEDIUM (Fix before v1.0)

### [H-005] Error Message Leakage
**Check:** Ensure catch blocks don't return raw error messages to clients.
```typescript
// BAD
catch (e) { return NextResponse.json({ error: e.message }); }

// GOOD
catch (e) {
  console.error('[route-name]', e);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

### [H-006] CORS Headers
Next.js App Router doesn't add CORS headers by default.
If you ever expose these routes externally, add explicit CORS configuration in `next.config.ts`.

### [H-007] Supabase Service Role Key Exposure
The `SUPABASE_SERVICE_ROLE_KEY` must:
- NEVER appear in any `NEXT_PUBLIC_*` variable
- NEVER be imported in any file under `app/` (client-accessible)
- Only be used in `app/api/` or server-only lib files
```bash
# Verify:
grep -rn "SUPABASE_SERVICE_ROLE" app/ --include="*.tsx" --include="*.ts"
# Should return nothing in components/ or app/ client files
```

---

## LOW / Ongoing

### [H-008] Dependency Audit
```bash
npm audit
# Run weekly; CI security.yml runs on schedule
```

### [H-009] Secret Scanning
```bash
# Check git history for leaked secrets:
git log --all --full-history -- '*.env' '*.env.local'
git grep -l "SUPABASE_SERVICE_ROLE\|ghp_\|AIza" $(git rev-list --all)
```

### [H-010] RLS Policy Completeness
For every table storing user data:
```sql
-- Verify RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Verify policies exist for all tables
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public';
```

---

## Status Tracking

| ID | Title | Severity | Status | Assigned |
|----|-------|----------|--------|---------|
| H-001 | Unauth AI routes | CRITICAL | ✅ CLOSED 2026-05-28 | backend |
| H-002 | user_id source | HIGH | NEEDS AUDIT | security |
| H-003 | Input size limits | HIGH | ✅ CLOSED 2026-05-28 | backend |
| H-004 | Rate limiting | HIGH | ✅ CLOSED 2026-05-28 | backend |
| H-005 | Error leakage | MEDIUM | NEEDS AUDIT | backend |
| H-006 | CORS | MEDIUM | LOW RISK NOW | — |
| H-007 | Service role exposure | MEDIUM | OPEN | security |
| H-008 | Dep audit | LOW | CI AUTO | — |
| H-009 | Secret scanning | LOW | OPEN | security |
| H-010 | RLS audit | LOW | OPEN | database |
