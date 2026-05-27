# ADR-003: Supabase over Firebase / PlanetScale / Neon

**Status:** Accepted
**Date:** 2026-05-27
**Author:** Engineering Team

## Context

The MVP validated core user flows. The persistence layer must be upgraded from localStorage to a server-side database to enable:
- Cross-device sync
- Secure AI context (server-side aggregation)
- User identity and authentication
- Photo storage beyond 4 MB

## Options Considered

| Option | Auth | DB | Storage | Next.js SSR | Price | Score |
|---|---|---|---|---|---|---|
| **Supabase** | ✅ Built-in | ✅ PostgreSQL | ✅ Built-in | ✅ @supabase/ssr | Free tier | **9/10** |
| Firebase | ✅ Built-in | ✅ Firestore | ✅ Built-in | ⚠️ Complex SSR | Free tier | 7/10 |
| PlanetScale | ❌ Separate | ✅ MySQL | ❌ Separate | ✅ | Free removed | 5/10 |
| Neon | ❌ Separate | ✅ PostgreSQL | ❌ Separate | ✅ | Free tier | 6/10 |
| Railway | ❌ Separate | ✅ PostgreSQL | ❌ Separate | ✅ | Paid | 5/10 |

## Decision

**Supabase.** Reasons:

1. **All-in-one:** Auth + PostgreSQL + Storage in one platform — no integration tax
2. **RLS:** Row Level Security at the DB level — security errors are caught at the data layer, not just the API layer
3. **`@supabase/ssr`:** First-class Next.js App Router support with cookie-based session management
4. **Type generation:** `supabase gen types typescript` keeps DB types in sync with code
5. **PostgreSQL:** Full SQL power — no NoSQL query limitations for analytics
6. **Free tier:** Sufficient for development and early production (500 MB DB, 1 GB storage)

## Consequences

### Positive
- Auth, DB, and Storage in one platform
- RLS enforces security at DB level (defense in depth)
- Type-safe queries via generated types
- Offline-first still possible via localStorage fallback

### Negative
- Supabase is a managed service — vendor lock-in risk
- RLS policies require careful testing (incorrect policies = data exposure)
- `@supabase/ssr` cookie handling requires middleware on every route
- Cold start latency on free tier (100ms–500ms first connection)

## Migration Strategy

See ADR-007 (Dual-write) for phased migration approach.

## Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` must never be prefixed `NEXT_PUBLIC_`
- All tables require RLS enabled before first INSERT
- RLS policies: `auth.uid() = user_id` on all data tables
