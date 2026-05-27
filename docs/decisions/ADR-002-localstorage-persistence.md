# ADR-002: localStorage as MVP Persistence Layer

**Status:** Superseded by ADR-003 (Supabase migration in progress)
**Date:** 2026-05-01
**Author:** Engineering Team

## Context

The project needed a persistence layer for the MVP. Requirements were:
- Fast development iteration
- No backend infrastructure
- Works offline immediately
- Zero cost during validation phase

## Decision

Use localStorage with a single JSON key `diet-tracker-v1` containing the full AppData object.

## Consequences

### Positive
- Zero infrastructure setup
- Instant read/write (synchronous)
- Works fully offline
- No auth required for MVP

### Negative (discovered during development)
- **4 MB storage limit** — base64 meal photos can exhaust storage in ~20 entries
- **No cross-device sync** — data exists only on one browser
- **Single point of failure** — one corrupt JSON = all data lost
- **No server-side AI context** — AI routes receive client-computed aggregates (trust issue)
- **No user identity** — cannot offer personalized analytics over time
- **Silent QuotaExceededError** — `setItem` failure swallowed in current implementation

## Migration Plan

See ADR-007 for dual-write migration strategy.
Migration target: Supabase PostgreSQL (ADR-003).

## Lessons Learned

- localStorage is appropriate for: preferences, UI state, offline-first caching
- localStorage is inappropriate for: primary data store with binary assets
- Always implement `QuotaExceededError` handling from day one
