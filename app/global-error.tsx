'use client';

/**
 * Last-resort boundary for errors in the root layout itself (UX P0 slice 1).
 * It replaces <html>/<body>, so no providers, fonts or globals.css are
 * available: inline styles and bilingual static text only.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#fff', color: '#1f2937' }}>
        <main style={{ maxWidth: 420, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>問題が発生しました</h1>
          <p style={{ fontSize: 14, color: '#4b5563', margin: '0 0 4px' }}>Something went wrong.</p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px', lineHeight: 1.6 }}>
            記録したデータはこの端末に残っています。 / Your logged data is still on this device.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 44, padding: '0 20px', borderRadius: 12, border: 0, background: '#378700', color: '#fff', fontWeight: 800, fontSize: 15 }}
          >
            もう一度試す / Try again
          </button>
        </main>
      </body>
    </html>
  );
}
