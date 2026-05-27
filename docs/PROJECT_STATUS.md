# Diet Tracker — Project Status

> Last updated: 2026-05-27
> Status: **Active Development — Phase A (Pre-Auth)**

## Current State

| Dimension | Status | Notes |
|---|---|---|
| TypeScript errors | ✅ 0 | Verified on every commit |
| Build | ✅ Passing | 13/13 pages |
| CI (GitHub Actions) | ✅ Passing | tsc + build + lint |
| Vercel Deploy | ✅ Live | Production URL on main push |
| Authentication | ❌ Not implemented | STEP 5 pending Supabase setup |
| Database | ❌ Not connected | Schema ready, awaiting Supabase project |
| AI Coaching | ✅ Working | Gemini 2.5 Flash, unauthenticated (risk) |
| PWA | ✅ Working | Manifest + SW + install banner |
| Export/Import | ✅ Working | JSON backup, CSV export, merge-by-id import |

## File Count

| Layer | Files |
|---|---|
| App pages | 7 |
| API routes | 3 |
| Components | 12 |
| Lib/data | 7 |
| Lib/core | 5 |
| Contexts | 1 |
| **Total** | **41** |

## Migration Progress (STEP 0–9)

| Step | Description | Status |
|---|---|---|
| STEP 0 | Dependency cleanup | ✅ Complete |
| STEP 1 | Type layer (WeeklyReport, DB types) | ✅ Complete |
| STEP 2 | Data access abstraction (lib/data/*) | ✅ Complete |
| STEP 3 | Supabase client singletons | ✅ Complete |
| STEP 4 | SQL migration file | ✅ Complete |
| ① | User: Supabase project creation | ⏳ Blocked (network) |
| ② | User: SQL migration execution | ⏳ Blocked |
| ③ | User: Google OAuth configuration | ⏳ Blocked |
| STEP 5 | Authentication (login, middleware, ProfileContext) | ⏳ Ready to implement |
| STEP 6 | Dual-write layer | ⏳ Pending |
| STEP 7 | localStorage migration utility | ⏳ Pending |
| STEP 8 | API hardening + Weekly Report | ⏳ Pending |
| STEP 9 | Analytics Dashboard | ⏳ Pending |

## Known Risks

| Risk | Severity | Status |
|---|---|---|
| AI API routes unauthenticated | HIGH | Mitigated post-STEP 8 |
| base64 photos in localStorage | HIGH | Mitigated post-STEP 6 |
| No error boundaries | MEDIUM | Issue created |
| Single localStorage key failure | MEDIUM | Mitigated post-STEP 6 |
| `lang="ja"` hardcoded in layout | LOW | Fix in STEP 5 |

## Links

- [Architecture](architecture/ARCHITECTURE.md)
- [Roadmap](roadmaps/ROADMAP.md)
- [Security Review](security/SECURITY_REVIEW.md)
- [ADR Index](decisions/ADR_INDEX.md)
- [OSS Research](research/OSS_RESEARCH_REPORT.md)
- [GitHub Repository](https://github.com/michaeltakao/diet-tracker)
- [Live App](https://diet-tracker.vercel.app)
