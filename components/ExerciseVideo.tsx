'use client';

import Image from 'next/image';
import { Film, ExternalLink } from 'lucide-react';
import { youtubeSearchUrl, type ExerciseVideo as ExerciseVideoDef } from '@/lib/exercise-db';
import { useLanguage } from '@/contexts/LanguageContext';

interface ExerciseVideoProps {
  video: ExerciseVideoDef | undefined;
  /** Display name, for the "coming soon" fallback text + alt text + fallback search. */
  exerciseName: string;
}

/**
 * Presentational only — no data fetching, no loading state. Every field it
 * needs already lives on the ExerciseDef passed in. Renders a local GIF, a
 * YouTube-search link card (plain <a>, not an embed), or a "coming soon"
 * fallback with a client-generated search link so even un-curated
 * exercises get something useful.
 */
export default function ExerciseVideo({ video, exerciseName }: ExerciseVideoProps) {
  const { t } = useLanguage();

  if (!video) {
    return (
      <div className="bg-surface-2 border border-line rounded-2xl p-4 flex items-center justify-between gap-3">
        <p className="text-xs text-faint flex items-center gap-1.5">
          <Film className="w-4 h-4 shrink-0" aria-hidden="true" /> {t.videoComingSoon}
        </p>
        <a
          href={youtubeSearchUrl(exerciseName)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded"
        >
          {t.videoSearchYoutube} <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </a>
      </div>
    );
  }

  if (video.type === 'local-gif') {
    return (
      <div className="relative h-52 rounded-2xl overflow-hidden border border-line bg-surface-2">
        {/* GIF animation would be lost through the Next image optimizer. */}
        <Image
          src={video.url}
          alt={video.title ?? exerciseName}
          fill
          unoptimized
          sizes="100vw"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-surface-2 border border-line rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-green-200 dark:hover:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      <p className="text-xs font-bold text-fg flex items-center gap-1.5">
        <Film className="w-4 h-4 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        {video.title ?? exerciseName}
      </p>
      <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-brand-600 dark:text-brand-400">
        {t.videoSearchYoutube} <ExternalLink className="w-3 h-3" aria-hidden="true" />
      </span>
    </a>
  );
}
