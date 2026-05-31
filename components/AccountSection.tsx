'use client';

/**
 * AccountSection — shown in Settings.
 * Guest mode:      Google/email sign-in buttons + benefit list.
 * Authenticated:   email display + sync badge + sign-out.
 * Supabase absent: renders nothing.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, LogOut, CheckCircle, Cloud, Brain, RefreshCw, Mail, X } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { isSupabaseConfigured } from '@/lib/supabase';

const BENEFITS = [
  { icon: Cloud,       text: '複数デバイスでデータ同期' },
  { icon: Brain,       text: 'AI提案がDBの全履歴を参照して精度向上' },
  { icon: RefreshCw,   text: 'ブラウザ削除してもデータが消えない' },
];

export default function AccountSection({ cardCls }: { cardCls: string }) {
  const { isAuthenticated, user, signInWithGoogle, signInWithEmail, signOut } = useProfile();
  const router = useRouter();
  const [emailMode, setEmailMode] = useState(false);
  const [email,     setEmail]     = useState('');
  const [sent,      setSent]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  if (!isSupabaseConfigured()) return null;

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try { await signInWithGoogle(); }
    catch { setError('Googleログインに失敗しました'); }
    finally { setLoading(false); }
  };

  const handleEmail = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    const result = await signInWithEmail(email.trim());
    setLoading(false);
    if (result.error) { setError(result.error); }
    else { setSent(true); }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  // ── Authenticated ──────────────────────────────────────────────────────────

  if (isAuthenticated && user) {
    return (
      <div className={`${cardCls} mb-3`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
            <CheckCircle size={18} className="text-green-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-faint uppercase tracking-widest">アカウント連携済み</p>
            <p className="text-sm font-bold text-fg truncate mt-0.5">
              {user.email}
            </p>
          </div>
          <span className="text-[10px] font-black text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full shrink-0">
            同期中
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-1 text-[11px] text-faint">
                <Icon size={10} className="text-green-400" />
                {text}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="mt-3 flex items-center gap-2 text-xs font-bold text-faint hover:text-danger transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <LogOut size={13} aria-hidden="true" />
          ログアウト
        </button>
      </div>
    );
  }

  // ── Guest ──────────────────────────────────────────────────────────────────

  return (
    <div className={`${cardCls} mb-3`}>
      <p className="text-xs font-black text-faint uppercase tracking-widest mb-3">アカウント連携</p>

      {/* Status */}
      <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-surface-2 rounded-2xl">
        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" aria-hidden="true" />
        <p className="text-xs font-bold text-muted">
          ゲストモード — データはこのデバイスのみに保存
        </p>
      </div>

      {/* Benefits */}
      <div className="space-y-1.5 mb-4">
        {BENEFITS.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-2">
            <Icon size={13} className="text-blue-400 shrink-0" />
            <p className="text-xs text-muted">{text}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      {!emailMode && !sent && (
        <div className="flex flex-col gap-2">
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-bold bg-card border-2 border-line-strong text-fg hover:border-faint disabled:opacity-50 transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? '接続中...' : 'Googleで連携'}
          </button>
          <button
            onClick={() => setEmailMode(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
          >
            <Mail size={15} aria-hidden="true" />
            メールで連携
          </button>
          <p className="text-[10px] text-center text-faint mt-1">
            連携しなくてもすべての機能を使えます
          </p>
        </div>
      )}

      {/* Email input */}
      {emailMode && !sent && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleEmail(); }}
              placeholder="メールアドレスを入力"
              aria-label="メールアドレス"
              className="flex-1 text-sm px-3 py-2.5 rounded-2xl border border-line-strong bg-surface-2 text-fg placeholder:text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
            <button
              onClick={() => { setEmailMode(false); setEmail(''); setError(null); }}
              aria-label="キャンセル"
              className="p-2.5 rounded-2xl border border-line-strong text-faint hover:text-fg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <button
            onClick={handleEmail}
            disabled={loading || !email.trim()}
            className="w-full py-2.5 rounded-2xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
          >
            {loading ? '送信中...' : 'マジックリンクを送信'}
          </button>
        </div>
      )}

      {/* Sent confirmation */}
      {sent && (
        <div className="px-3 py-3 bg-green-50 dark:bg-green-900/20 rounded-2xl text-center">
          <p className="text-sm font-bold text-green-700 dark:text-green-300">メールを送信しました</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
            リンクをクリックすると自動的に連携されます
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger text-center">{error}</p>
      )}
    </div>
  );
}
