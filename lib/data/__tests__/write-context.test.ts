/** lib/data/_write.ts — when a Supabase write is attempted at all (ADR-008 P0-7). */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  configured: true,
  user: { id: 'u1' } as { id: string } | null,
  throws: false,
};
vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: () => state.configured,
  getCurrentUser: async () => {
    if (state.throws) throw new Error('network');
    return state.user;
  },
  createClient: () => ({ marker: 'client' }),
}));

import { getWriteContext } from '../_write';

describe('getWriteContext', () => {
  beforeEach(() => {
    state.configured = true;
    state.user = { id: 'u1' };
    state.throws = false;
  });

  it('configured + signed in → client and user id', async () => {
    expect(await getWriteContext()).toEqual({ supabase: { marker: 'client' }, userId: 'u1' });
  });
  it('Supabase not configured → null', async () => {
    state.configured = false;
    expect(await getWriteContext()).toBeNull();
  });
  it('guest (no user) → null', async () => {
    state.user = null;
    expect(await getWriteContext()).toBeNull();
  });
  it('getUser fails (offline) → null, never throws (the outbox then queues by stored session)', async () => {
    state.throws = true;
    expect(await getWriteContext()).toBeNull();
  });
});
