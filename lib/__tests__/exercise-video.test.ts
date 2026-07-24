import { describe, it, expect } from 'vitest';
import { EXERCISE_DB, youtubeSearchUrl } from '@/lib/exercise-db';

// Every id currently carrying `recommended` (12 legacy starter-menu
// exercises) plus a few unambiguous, high-search-volume compounds. Kept in
// sync manually with lib/exercise-db.ts — a mismatch here should fail loud
// rather than silently pass.
const CURATED_VIDEO_IDS = [
  'bench-press', 'dumbbell-fly', 'push-up',
  'lat-pulldown', 'deadlift', 'pull-up',
  'barbell-squat', 'leg-press',
  'shoulder-press', 'side-raise', 'overhead-press',
  'arm-curl', 'triceps-pressdown',
  'crunch', 'plank',
] as const;

describe('exercise video/demo-media (static assets only, no third-party API)', () => {
  it('every `local-gif` video url is a local path under /exercise-media/', () => {
    for (const e of EXERCISE_DB) {
      if (e.video?.type === 'local-gif') {
        expect(e.video.url, e.id).toMatch(/^\/exercise-media\//);
        if (e.video.thumbnail) {
          expect(e.video.thumbnail, e.id).toMatch(/^\/exercise-media\//);
        }
      }
    }
  });

  it('every `youtube-search` video url points at youtube.com/results — never a remote-API host', () => {
    for (const e of EXERCISE_DB) {
      if (e.video?.type === 'youtube-search') {
        expect(e.video.url, e.id).toMatch(/^https:\/\/www\.youtube\.com\/results\?search_query=/);
      }
    }
  });

  it('youtubeSearchUrl() is deterministic and properly encodes the query', () => {
    const url = youtubeSearchUrl('Bench Press');
    expect(url).toBe('https://www.youtube.com/results?search_query=Bench%20Press%20exercise%20form');
    expect(youtubeSearchUrl('Bench Press')).toBe(url);
  });

  it('all 12 `recommended` entries have a defined video (regression guard)', () => {
    const recommended = EXERCISE_DB.filter((e) => e.recommended);
    expect(recommended.length).toBe(12);
    for (const e of recommended) {
      expect(e.video, e.id).toBeDefined();
    }
  });

  it('the curated subset has video coverage and every listed id exists', () => {
    for (const id of CURATED_VIDEO_IDS) {
      const e = EXERCISE_DB.find((x) => x.id === id);
      expect(e, id).toBeDefined();
      expect(e!.video, id).toBeDefined();
    }
  });

  it('video coverage is still partial, growing but not yet complete (undefined remains the common case)', () => {
    const withVideo = EXERCISE_DB.filter((e) => e.video !== undefined);
    // Coverage grows over time as more exercises get demo images (see
    // public/exercise-media/README.md for the running count and the
    // exact-name-match-only policy). This assertion only guards that we
    // haven't silently mapped every entry (which would suggest fuzzy
    // matching slipped in) while still requiring the curated baseline.
    expect(withVideo.length).toBeLessThan(EXERCISE_DB.length);
    expect(withVideo.length).toBeGreaterThanOrEqual(CURATED_VIDEO_IDS.length);
  });
});
