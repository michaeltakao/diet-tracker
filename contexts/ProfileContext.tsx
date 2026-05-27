'use client';

/**
 * ProfileContext — Authentication + profile/goals state.
 *
 * Wraps the entire app (via ProfileProvider in layout.tsx).
 * Exposes the current Supabase user, profile row, and goals.
 *
 * Design contract:
 * - When Supabase is NOT configured (placeholder env vars): all auth fields
 *   are null/false; goals fall back to localStorage. App runs in guest mode.
 * - When Supabase IS configured: auth state is live via onAuthStateChange.
 * - `goals` always resolves: DB profile → localStorage → hardcoded defaults.
 *
 * STEP 6 change: updateGoals will dual-write to Supabase AND localStorage.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { User } from '@supabase/supabase-js';
import type { ProfileRow } from '@/lib/database.types';
import type { DailyGoals } from '@/lib/types';
import { createClient } from '@/lib/supabase';
import { getGoals, updateGoals as _updateLocalGoals } from '@/lib/data/profile';

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

/**
 * Returns true when the environment has real Supabase credentials.
 * False = placeholder/empty = localStorage-only guest mode.
 */
export function isSupabaseConfigured(): boolean {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? '';
  const key  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const hasUrl = url.length > 0 && !url.includes('placeholder') && !url.includes('xxxx');
  const hasKey = key.length > 0 && !key.includes('placeholder');
  return hasUrl && hasKey;
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
  user:            null,
  profile:         null,
  isLoading:       false,
  isAuthenticated: false,
  goals:           DEFAULT_GOALS,
  signInWithGoogle:  async () => {},
  signInWithEmail:   async () => ({ error: null }),
  signOut:           async () => {},
  updateGoals:       () => {},
  refreshProfile:    async () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [user,      setUser]      = useState<User | null>(null);
  const [profile,   setProfile]   = useState<ProfileRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      } else {
        setIsLoading(false);
      }
    }).catch(() => setIsLoading(false));

    // Live subscription: handle sign-in / sign-out / token-refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const newUser = session?.user ?? null;
        setUser(newUser);
        if (newUser) {
          await fetchProfile(newUser.id);
        } else {
          setProfile(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [supabaseEnabled, fetchProfile]);

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
    // Always update localStorage (offline fallback, STEP 2 contract)
    _updateLocalGoals(goals);

    // STEP 6 NOTE: add Supabase write here once dual-write layer is active
    // For now, update local profile state for immediate UI reflection
    if (user && profile) {
      setProfile(prev => prev ? {
        ...prev,
        goal_calories:  goals.calories,
        goal_protein_g: goals.protein,
        goal_fat_g:     goals.fat,
        goal_carbs_g:   goals.carbs,
        goal_water_ml:  goals.water,
        goal_weight_kg: goals.goalWeight ?? null,
      } : prev);
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
      isAuthenticated: user !== null,
      goals,
      signInWithGoogle,
      signInWithEmail,
      signOut,
      updateGoals,
      refreshProfile,
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useProfile(): ProfileContextType {
  return useContext(ProfileContext);
}
