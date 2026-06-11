'use client';

/**
 * ProfileContext — Authentication + profile/goals state + migration orchestration.
 *
 * Wraps the entire app (via ProfileProvider in layout.tsx).
 * Exposes the current Supabase user, profile row, goals, and migration state.
 *
 * Design contract:
 * - When Supabase is NOT configured (placeholder env vars): all auth fields
 *   are null/false; goals fall back to localStorage. App runs in guest mode.
 * - When Supabase IS configured: auth state is live via onAuthStateChange.
 * - `goals` always resolves: DB profile → localStorage → hardcoded defaults.
 * - Migration runs once on first authenticated login (STEP 7).
 *
 * STEP 6 change: updateGoals dual-writes to Supabase AND localStorage.
 * STEP 7 change: migration triggered after auth; MigrationBanner rendered here.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { User } from '@supabase/supabase-js';
import type { ProfileRow } from '@/lib/database.types';
import type { DailyGoals } from '@/lib/types';
import { createClient, isSupabaseConfigured } from '@/lib/supabase';
import { getGoals, updateGoals as _updateLocalGoals } from '@/lib/data/profile';
import {
  needsMigration,
  executeMigration,
  markMigrationComplete,
} from '@/lib/migrate';
import type { MigrationStatus, MigrationSummary } from '@/lib/migrate';
import MigrationBanner from '@/components/MigrationBanner';

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_GOALS: DailyGoals = {
  calories:   2000,
  protein:    150,
  fat:        60,
  carbs:      200,
  water:      2000,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function profileToGoals(p: ProfileRow): DailyGoals {
  return {
    calories:   p.goal_calories,
    protein:    p.goal_protein_g,
    fat:        p.goal_fat_g,
    carbs:      p.goal_carbs_g,
    water:      p.goal_water_ml,
    goalWeight: p.goal_weight_kg ?? undefined,
  };
}

// ── Context type ──────────────────────────────────────────────────────────────

interface ProfileContextType {
  /** Supabase Auth user object. null when not authenticated. */
  user:            User | null;
  /** Database profile row. null when not authenticated or still loading. */
  profile:         ProfileRow | null;
  /** True while the initial auth check is in flight. */
  isLoading:       boolean;
  /** Shortcut: user !== null. */
  isAuthenticated: boolean;
  /**
   * Resolved daily goals.
   * Source priority: DB profile > localStorage > hardcoded defaults.
   */
  goals:           DailyGoals;
  /** Current migration state (STEP 7). */
  migrationStatus:  MigrationStatus;
  /** Per-table record counts after a successful migration. */
  migrationSummary: MigrationSummary | null;
  /** Trigger Google OAuth redirect. */
  signInWithGoogle:  () => Promise<void>;
  /** Send an OTP magic link to the given email. */
  signInWithEmail:   (email: string) => Promise<{ error: string | null }>;
  /** Sign out and clear session. */
  signOut:           () => Promise<void>;
  /** Persist updated goals. Writes to localStorage; DB write added in STEP 6. */
  updateGoals:       (goals: DailyGoals) => void;
  /** Re-fetch profile from Supabase. */
  refreshProfile:    () => Promise<void>;
}

// ── Context + default (for useContext before Provider mounts) ─────────────────

const ProfileContext = createContext<ProfileContextType>({
  user:             null,
  profile:          null,
  isLoading:        false,
  isAuthenticated:  false,
  goals:            DEFAULT_GOALS,
  migrationStatus:  'idle',
  migrationSummary: null,
  signInWithGoogle:  async () => {},
  signInWithEmail:   async () => ({ error: null }),
  signOut:           async () => {},
  updateGoals:       () => {},
  refreshProfile:    async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [user,             setUser]             = useState<User | null>(null);
  const [profile,          setProfile]          = useState<ProfileRow | null>(null);
  const [isLoading,        setIsLoading]        = useState(true);
  const [migrationStatus,  setMigrationStatus]  = useState<MigrationStatus>('idle');
  const [migrationSummary, setMigrationSummary] = useState<MigrationSummary | null>(null);
  // Prevents double-trigger on INITIAL_SESSION + getUser() both firing on mount
  const migrationTriggeredRef = useRef(false);

  const supabaseEnabled = isSupabaseConfigured();

  // ── Fetch profile row from DB ──────────────────────────────────────────────

  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabaseEnabled) return;
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setProfile(data as ProfileRow);
      }
    } catch {
      // Network error — silently ignore; profile stays null
    }
  }, [supabaseEnabled]);

  // ── Migration (STEP 7) ─────────────────────────────────────────────────────
  // Defined BEFORE useEffect so the dependency array can reference it safely.

  const triggerMigration = useCallback(async (userId: string) => {
    if (!supabaseEnabled) return;
    // Guard: only run once per Provider mount (INITIAL_SESSION + getUser both fire)
    if (migrationTriggeredRef.current) return;
    migrationTriggeredRef.current = true;

    setMigrationStatus('checking');
    const supabase = createClient();

    try {
      const needed = await needsMigration(supabase, userId);
      if (!needed) {
        setMigrationStatus('idle');
        return;
      }

      setMigrationStatus('migrating');

      // Hard 30-second timeout — never block auth flow indefinitely
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Migration timed out after 30 s')), 30_000),
      );

      const result = await Promise.race([
        executeMigration(supabase, userId),
        timeoutPromise,
      ]);

      // Mark complete in DB + localStorage
      await markMigrationComplete(supabase, userId);

      setMigrationSummary(result.summary ?? null);
      setMigrationStatus('success');
      // Auto-dismiss banner after 5 seconds
      setTimeout(() => setMigrationStatus('idle'), 5_000);
    } catch (err) {
      console.error('[MIGRATION_ERROR] ProfileContext:', err);
      setMigrationStatus('error');
    }
  }, [supabaseEnabled]);

  // ── Initial auth check + subscription ──────────────────────────────────────

  useEffect(() => {
    if (!supabaseEnabled) {
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    // One-shot: resolve current session on mount
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id).finally(() => setIsLoading(false));
        // Trigger migration for already-logged-in users (ref guard prevents double-run
        // if onAuthStateChange also fires INITIAL_SESSION)
        void triggerMigration(currentUser.id);
      } else {
        setIsLoading(false);
      }
    }).catch(() => setIsLoading(false));

    // Live subscription: handle sign-in / sign-out / token-refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const newUser = session?.user ?? null;
        setUser(newUser);
        if (newUser) {
          await fetchProfile(newUser.id);
          // Trigger migration on fresh sign-in (ref guard prevents re-run if already done)
          if (event === 'SIGNED_IN') {
            void triggerMigration(newUser.id);
          }
        } else {
          setProfile(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [supabaseEnabled, fetchProfile, triggerMigration]);

  // ── Auth methods ───────────────────────────────────────────────────────────

  const signInWithGoogle = useCallback(async () => {
    if (!supabaseEnabled) return;
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, [supabaseEnabled]);

  const signInWithEmail = useCallback(async (email: string) => {
    if (!supabaseEnabled) return { error: 'Supabase not configured' };
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error: error?.message ?? null };
  }, [supabaseEnabled]);

  const signOut = useCallback(async () => {
    if (!supabaseEnabled) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabaseEnabled]);

  // ── Goals ──────────────────────────────────────────────────────────────────

  const updateGoals = useCallback((goals: DailyGoals) => {
    _updateLocalGoals(goals);

    if (user && profile) {
      const next = {
        ...profile,
        goal_calories:  goals.calories,
        goal_protein_g: goals.protein,
        goal_fat_g:     goals.fat,
        goal_carbs_g:   goals.carbs,
        goal_water_ml:  goals.water,
        goal_weight_kg: goals.goalWeight ?? null,
      };
      setProfile(next);

      // Dual-write to Supabase (fire-and-forget)
      const supabase = createClient();
      void supabase.from('profiles').update({
        goal_calories:  goals.calories,
        goal_protein_g: goals.protein,
        goal_fat_g:     goals.fat,
        goal_carbs_g:   goals.carbs,
        goal_water_ml:  goals.water,
        goal_weight_kg: goals.goalWeight ?? null,
      }).eq('id', user.id).then(({ error }) => {
        if (error) console.warn('[ProfileContext] updateGoals Supabase failed:', error.message);
      });
    }
  }, [user, profile]);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  // ── Resolved goals: DB > localStorage > defaults ───────────────────────────

  const goals: DailyGoals = profile
    ? profileToGoals(profile)
    : (() => {
        try { return getGoals(); } catch { return DEFAULT_GOALS; }
      })();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ProfileContext.Provider value={{
      user,
      profile,
      isLoading,
      isAuthenticated:  user !== null,
      goals,
      migrationStatus,
      migrationSummary,
      signInWithGoogle,
      signInWithEmail,
      signOut,
      updateGoals,
      refreshProfile,
    }}>
      {/* Migration banner — shown only while migration is in progress or just finished */}
      <MigrationBanner
        status={migrationStatus}
        summary={migrationSummary ?? undefined}
        onDismiss={() => setMigrationStatus('idle')}
      />
      {children}
    </ProfileContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useProfile(): ProfileContextType {
  return useContext(ProfileContext);
}
