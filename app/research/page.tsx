'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FlaskConical, Download, Users, TrendingUp, RefreshCw, ChevronLeft } from 'lucide-react';
import type { ParticipantSummary } from '@/app/api/research/participants/route';
import { getJson } from '@/lib/httpClient';
import { CARD_CLASS as CARD } from '@/components/ui/Card';


function statusBadge(lastFoodLog: string | null): { label: string; color: string } {
  if (!lastFoodLog) return { label: '未ログ', color: 'text-faint bg-surface-2' };
  const today    = new Date().toISOString().slice(0, 10);
  const diffDays = Math.floor(
    (new Date(today).getTime() - new Date(lastFoodLog).getTime()) / 86_400_000,
  );
  if (diffDays === 0) return { label: '活発', color: 'text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30' };
  if (diffDays <= 2)  return { label: '注意', color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30' };
  return { label: '離脱リスク', color: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30' };
}

function fmt(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

export default function ResearchPage() {
  const [participants, setParticipants] = useState<ParticipantSummary[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error,   setError]             = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getJson<ParticipantSummary[]>('/api/research/participants');
      setParticipants(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState called after await
    void load();
  }, []);

  // Cohort-level aggregates
  const total         = participants.length;
  const totalFood     = participants.reduce((s, p) => s + p.food_log_count, 0);
  const avgFood       = total > 0 ? Math.round(totalFood / total) : 0;
  const totalAccept   = participants.reduce((s, p) => s + p.accept_count, 0);
  const totalReject   = participants.reduce((s, p) => s + p.reject_count, 0);
  const totalFb       = totalAccept + totalReject;
  const acceptRate    = totalFb > 0 ? Math.round((totalAccept / totalFb) * 100) : null;

  const exportUrl = (fmt: string) => `/api/research/export?format=${fmt}`;

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-faint hover:text-muted transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <FlaskConical size={18} className="text-violet-500" />
                <h1 className="text-sm font-black text-fg">研究ダッシュボード</h1>
              </div>
              <p className="text-xs text-faint">University of Aizu — Prof. Hamada Lab</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              disabled={loading}
              className="p-2 rounded-xl text-faint hover:text-muted transition-colors"
              aria-label="更新"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <a
              href={exportUrl('json')}
              download
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs font-bold hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
            >
              <Download size={11} />
              全データ
            </a>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-3 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Cohort summary cards */}
        {!error && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: <Users size={14} />, label: '参加者', value: String(total), unit: '名' },
              { icon: <TrendingUp size={14} />, label: '平均食事ログ', value: String(avgFood), unit: '件' },
              { icon: <TrendingUp size={14} />, label: '推薦採用率', value: acceptRate != null ? `${acceptRate}%` : '—', unit: '' },
            ].map(({ icon, label, value, unit }) => (
              <div key={label} className={`${CARD} p-3 text-center`}>
                <div className="flex justify-center text-violet-500 mb-1">{icon}</div>
                <div className="text-lg font-black text-fg tabular-nums">{value}<span className="text-xs font-normal text-faint ml-0.5">{unit}</span></div>
                <div className="text-[10px] text-faint">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Participant table */}
        {!error && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <p className="text-[10px] font-black text-faint uppercase tracking-widest">
                参加者一覧 ({total}名)
              </p>
              <a href={exportUrl('csv')} download className="text-[10px] text-violet-500 hover:underline flex items-center gap-1">
                <Download size={10} /> CSV
              </a>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-10 gap-2 text-xs text-faint">
                <RefreshCw size={13} className="animate-spin" /> 読み込み中...
              </div>
            )}

            {!loading && participants.length === 0 && (
              <p className="text-xs text-faint text-center py-8">参加者がいません（同意済みユーザーのみ表示）</p>
            )}

            {!loading && participants.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line">
                      {['表示名', 'コホート', '登録日', '最終ログ', '食事', '体重', '採用/拒否', '状態'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] font-black text-faint uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {participants.map(p => {
                      const status = statusBadge(p.last_food_log);
                      const fbTotal = p.accept_count + p.reject_count;
                      return (
                        <tr key={p.id} className="hover:bg-surface-2 transition-colors">
                          <td className="px-3 py-2 font-medium text-fg truncate max-w-[120px]">
                            {p.display_name ?? '(名前なし)'}
                          </td>
                          <td className="px-3 py-2 text-faint">{p.study_cohort ?? '—'}</td>
                          <td className="px-3 py-2 text-faint whitespace-nowrap">{fmt(p.consented_at)}</td>
                          <td className="px-3 py-2 text-faint whitespace-nowrap">{fmt(p.last_food_log)}</td>
                          <td className="px-3 py-2 tabular-nums text-center">{p.food_log_count}</td>
                          <td className="px-3 py-2 tabular-nums text-center">{p.weight_log_count}</td>
                          <td className="px-3 py-2 tabular-nums text-center text-faint">
                            <span className="text-brand-600 dark:text-brand-400">{p.accept_count}</span>
                            {' / '}
                            <span className="text-red-500">{p.reject_count}</span>
                            {fbTotal > 0 && (
                              <span className="text-[9px] ml-1">({Math.round(p.accept_count / fbTotal * 100)}%)</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full ${status.color}`}>
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Per-table export links */}
        {!error && (
          <div className={`${CARD} p-4`}>
            <p className="text-[10px] font-black text-faint uppercase tracking-widest mb-3">テーブル別エクスポート</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { table: 'food_logs',                label: '食事ログ' },
                { table: 'weight_logs',              label: '体重ログ' },
                { table: 'workout_logs',             label: '運動ログ' },
                { table: 'recommendation_feedback',  label: '推薦フィードバック' },
              ].map(({ table, label }) => (
                <a
                  key={table}
                  href={`/api/research/export?table=${table}&format=csv`}
                  download
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-surface-2 hover:bg-card text-xs text-muted transition-colors"
                >
                  <Download size={11} className="text-violet-400" />
                  {label} (CSV)
                </a>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
