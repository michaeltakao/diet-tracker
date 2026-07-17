'use client';

/**
 * Settings-page card for Web Push on/off (FTUE P0 #7, second half).
 *
 * The permanent re-entry point after the dashboard card's sticky dismissal.
 * Push is authenticated-users-only; the card renders nothing for guests or
 * when Supabase/VAPID is unconfigured. Unsupported browsers (notably plain
 * iOS Safari) get the Home-Screen-install note instead of a dead button.
 */

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  isPushSupported,
  hasPushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push-client';
import { useProfile } from '@/contexts/ProfileContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/Button';

type RowState =
  | 'hidden'      // guest / unconfigured / pre-mount
  | 'unsupported' // no Push API (plain iOS Safari) → install note
  | 'denied'      // browser-level block → point at browser settings
  | 'off'         // permission default, or granted without a subscription
  | 'on'          // granted + subscribed
  | 'busy'
  | 'error';

export default function PushSettingsRow({ cardCls }: { cardCls: string }) {
  const { t } = useLanguage();
  const { isAuthenticated } = useProfile();
  const [state, setState] = useState<RowState>('hidden');

  useEffect(() => {
    if (
      !isSupabaseConfigured() ||
      !isAuthenticated ||
      !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe client-only capability read on mount
      setState('hidden');
      return;
    }
    if (!isPushSupported()) {
       
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
       
      setState('denied');
      return;
    }
    let cancelled = false;
    void hasPushSubscription().then((subscribed) => {
      if (!cancelled) {
        setState(Notification.permission === 'granted' && subscribed ? 'on' : 'off');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  if (state === 'hidden') return null;

  const enable = async () => {
    setState('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const ok = await subscribeToPush();
      setState(ok ? 'on' : 'error');
    } catch {
      setState('error');
    }
  };

  const disable = async () => {
    setState('busy');
    const ok = await unsubscribeFromPush();
    setState(ok ? 'off' : 'error');
  };

  return (
    <div className={`${cardCls} mb-3`}>
      <label className="block text-xs font-black text-faint uppercase tracking-widest mb-3">
        {t.pushSettingsTitle}
      </label>

      {state === 'unsupported' && (
        <p className="text-xs text-muted leading-relaxed">{t.pushIosNote}</p>
      )}

      {state === 'denied' && (
        <p className="text-xs text-muted leading-relaxed">{t.pushDenied}</p>
      )}

      {(state === 'off' || state === 'busy' || state === 'error') && (
        <>
          {state === 'error' && (
            <p className="text-xs text-red-500 mb-2">{t.pushError}</p>
          )}
          <Button className="w-full" onClick={enable} disabled={state === 'busy'}>
            <Bell size={16} aria-hidden="true" />
            {t.pushEnable}
          </Button>
        </>
      )}

      {state === 'on' && (
        <>
          <p className="text-xs text-muted mb-3">{t.pushSettingsOn}</p>
          <Button variant="ghost" className="w-full" onClick={disable}>
            {t.pushDisable}
          </Button>
        </>
      )}
    </div>
  );
}
