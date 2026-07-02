'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, CheckCircle2, Shield } from 'lucide-react';
import { postJson } from '@/lib/httpClient';

const CARD = 'bg-card rounded-3xl shadow-card border border-line';

export default function ConsentPage() {
  const router = useRouter();
  const [agreed,    setAgreed]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [done,      setDone]      = useState(false);

  const handleConsent = async () => {
    if (!agreed) return;
    setSubmitting(true);
    setError(null);
    try {
      await postJson('/api/consent', {});
      setDone(true);
      setTimeout(() => router.replace('/'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 size={48} className="text-emerald-500" />
          <p className="text-sm font-bold text-fg">同意を記録しました</p>
          <p className="text-xs text-faint">ダッシュボードに移動します…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-lg space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <ClipboardList size={24} className="text-violet-500" />
          <div>
            <h1 className="text-base font-black text-fg">研究参加同意書</h1>
            <p className="text-xs text-faint">University of Aizu — Prof. Hamada Lab</p>
          </div>
        </div>

        {/* Study description */}
        <div className={`${CARD} p-4 space-y-3 text-xs text-muted leading-relaxed`}>
          <section>
            <h2 className="font-bold text-fg mb-1">研究目的</h2>
            <p>
              本研究は、説明可能なAI（XAI）を用いた食事推薦が利用者の推薦受諾率と
              食習慣改善に与える影響を調査します。収集したデータは、学術論文の執筆
              および大学院修士論文に使用される場合があります。
            </p>
          </section>

          <section>
            <h2 className="font-bold text-fg mb-1">収集するデータ</h2>
            <ul className="list-disc list-inside space-y-0.5">
              <li>食事ログ（食品名・カロリー・栄養素）</li>
              <li>体重ログ</li>
              <li>運動ログ</li>
              <li>AI推薦への反応（採用・スキップ・お気に入り）</li>
              <li>アプリ利用頻度・継続率</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-fg mb-1">データの取り扱い</h2>
            <ul className="list-disc list-inside space-y-0.5">
              <li>収集したデータは研究目的にのみ使用します</li>
              <li>氏名等の個人を特定できる情報は論文に記載しません</li>
              <li>データはSupabase（暗号化・RLSで保護）に保存されます</li>
              <li>研究終了後、いつでもデータの削除を請求できます（個人情報保護法第35条）</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-fg mb-1">第三者サービスへのデータ送信</h2>
            <p>
              食事写真からカロリーを推定するため、アップロードした画像を
              Google Gemini API（Google LLC）に送信します。
              Google のAPIデータ処理ポリシーにより、APIリクエストの入力は
              モデルの学習に使用されません。詳細は
              Google の「生成AIの補足利用規約」をご確認ください。
              画像以外の個人データ（体重・食事ログ等）はGoogleに送信されません。
            </p>
          </section>

          <section>
            <h2 className="font-bold text-fg mb-1">参加の任意性と撤回</h2>
            <p>
              参加は自由意志に基づくものであり、いつでも撤回できます。
              撤回したい場合は研究担当者（下記）へご連絡ください。
              撤回によって不利益は一切生じません。
            </p>
          </section>

          <section>
            <h2 className="font-bold text-fg mb-1">研究担当者</h2>
            <p>
              University of Aizu — Software Engineering Lab<br />
              指導教員: Prof. Mohamed Hamada
            </p>
          </section>
        </div>

        {/* Privacy badge */}
        <div className="flex items-center gap-2 text-xs text-faint">
          <Shield size={12} className="text-emerald-500 flex-shrink-0" />
          <span>あなたのデータはRow Level Securityで保護され、第三者に提供されません</span>
        </div>

        {/* Agreement checkbox */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-violet-600 flex-shrink-0"
          />
          <span className="text-xs text-muted leading-relaxed">
            上記の内容を理解し、研究への参加に同意します。
          </span>
        </label>

        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.replace('/')}
            className="flex-1 py-3 rounded-2xl text-xs font-bold text-faint bg-surface-2 hover:bg-card transition-colors"
          >
            後で決める
          </button>
          <button
            type="button"
            onClick={handleConsent}
            disabled={!agreed || submitting}
            className={`
              flex-1 py-3 rounded-2xl text-xs font-bold transition-all
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]
              ${agreed && !submitting
                ? 'bg-violet-600 text-white hover:bg-violet-700 active:scale-95'
                : 'bg-surface-2 text-faint cursor-not-allowed'}
            `}
          >
            {submitting ? '送信中...' : '同意して開始'}
          </button>
        </div>

      </div>
    </div>
  );
}
