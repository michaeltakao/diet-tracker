'use client';

/**
 * Camera barcode scanner → Open Food Facts product lookup.
 *
 * Decode strategy: native `BarcodeDetector` when the browser has it
 * (Chrome/Edge/Android); otherwise `@zxing/browser`, loaded via dynamic
 * import only on that path so it never lands in the shared chunks. On a
 * valid EAN/UPC decode the camera stops, /api/product-lookup resolves the
 * product, and `onProduct` fires with the normalized per-100g nutrition.
 */

import { useEffect, useRef, useState } from 'react';
import { ScanBarcode, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { postJson, HttpError } from '@/lib/httpClient';
import { isValidBarcode, type NormalizedProduct } from '@/lib/off';
import { useLanguage } from '@/contexts/LanguageContext';

// Minimal typing for the (not-yet-in-lib.dom) native BarcodeDetector API.
interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

type ScanPhase = 'starting' | 'scanning' | 'lookingUp' | 'found' | 'error';

interface BarcodeScannerProps {
  /** Fires once per successful scan+lookup with the EAN that produced it. */
  onProduct: (product: NormalizedProduct, barcode: string) => void;
}

export function BarcodeScanner({ onProduct }: BarcodeScannerProps) {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [phase, setPhase] = useState<ScanPhase>('starting');
  const [error, setError] = useState<string | null>(null);
  const [foundName, setFoundName] = useState<string | null>(null);
  // Bumping restarts the camera effect (rescan button).
  const [session, setSession] = useState(0);

  useEffect(() => {
    // Messages captured at capture-session start; a mid-scan language switch
    // shows the old language once — acceptable for an error toast.
    const msg = { denied: t.barcodeCameraDenied, notFound: t.barcodeNotFound, failed: t.productLookupError };
    let cancelled = false;
    let stream: MediaStream | null = null;
    let intervalId: number | undefined;
    let zxingControls: { stop(): void } | null = null;
    let busy = false; // decode callbacks keep firing — process the first hit only

    const stopCapture = () => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
      zxingControls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
    };

    const handleDecode = async (raw: string) => {
      if (busy || cancelled || !isValidBarcode(raw)) return;
      busy = true;
      stopCapture();
      setPhase('lookingUp');
      try {
        const product = await postJson<NormalizedProduct>('/api/product-lookup', { barcode: raw });
        if (cancelled) return;
        setFoundName(product.name);
        setPhase('found');
        onProduct(product, raw);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof HttpError && err.status === 404 ? msg.notFound : msg.failed);
        setPhase('error');
      }
    };

    const start = async () => {
      const video = videoRef.current;
      if (!video) return;

      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      try {
        if (Detector) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return; }
          video.srcObject = stream;
          await video.play();
          const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
          intervalId = window.setInterval(() => {
            if (busy || video.readyState < 2) return;
            detector.detect(video).then((codes) => {
              const hit = codes.find((c) => isValidBarcode(c.rawValue));
              if (hit) void handleDecode(hit.rawValue);
            }).catch(() => { /* per-frame decode errors are expected — keep scanning */ });
          }, 300);
        } else {
          // Fallback: zxing manages the camera itself. Dynamic import keeps the
          // library out of the bundle for BarcodeDetector-capable browsers.
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          zxingControls = await reader.decodeFromVideoDevice(undefined, video, (result) => {
            if (result) void handleDecode(result.getText());
          });
          if (cancelled) { zxingControls.stop(); return; }
        }
        if (!cancelled) setPhase('scanning');
      } catch (err) {
        console.warn('[BarcodeScanner] camera start failed:', err);
        if (!cancelled) {
          setError(msg.denied);
          setPhase('error');
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopCapture();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session bump = rescan; onProduct is stable enough for a capture session
  }, [session]);

  const showVideo = phase === 'starting' || phase === 'scanning' || phase === 'lookingUp';

  return (
    <div className="space-y-3">
      {showVideo && (
        <div className="relative">
          {/* muted+playsInline: iOS Safari refuses inline autoplay otherwise */}
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full h-64 rounded-2xl object-cover bg-black"
            aria-label={t.scanBarcode}
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {phase === 'lookingUp' ? (
              <Loader2 size={28} className="animate-spin text-white" aria-hidden="true" />
            ) : (
              <div className="w-3/4 h-24 border-2 border-white/70 rounded-xl" aria-hidden="true" />
            )}
          </div>
        </div>
      )}

      {showVideo && (
        <p className="text-xs text-faint text-center flex items-center justify-center gap-1.5">
          <ScanBarcode size={14} aria-hidden="true" />
          {t.scanBarcode}
        </p>
      )}

      {phase === 'found' && foundName && (
        <div role="status" className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-xl p-3 text-sm">
          <CheckCircle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span className="font-medium">{foundName}</span>
        </div>
      )}

      {phase === 'error' && error && (
        <div role="alert" className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl p-3 text-sm">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {(phase === 'found' || phase === 'error') && (
        <button
          onClick={() => {
            // Reset here (event handler) so the effect never sets state synchronously.
            setPhase('starting');
            setError(null);
            setFoundName(null);
            setSession((s) => s + 1);
          }}
          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-surface-2 text-muted hover:bg-line transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {t.barcodeRescan}
        </button>
      )}
    </div>
  );
}
