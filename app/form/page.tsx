'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, Camera, CameraOff, RotateCcw,
  Activity, Info, Upload,
} from 'lucide-react';
import { SquatAnalyzer, DEFAULT_IDEAL_FORM } from '@/lib/pose/exercises/squat';
import type { SquatAnalyzerState, SquatIdealForm, RepFeedback } from '@/lib/pose/exercises/squat';
import BottomNav from '@/components/BottomNav';

// ── Types ──────────────────────────────────────────────────────────────────

type PoseLandmarker = import('@mediapipe/tasks-vision').PoseLandmarker;
type DrawingUtils  = import('@mediapipe/tasks-vision').DrawingUtils;

// ── Constants ──────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<string, string> = {
  IDLE:       '準備完了',
  DESCENDING: '↓ 下降中',
  BOTTOM:     '● ボトム',
  ASCENDING:  '↑ 上昇中',
  COMPLETE:   '✓ 完了',
};

const PHASE_COLOR: Record<string, string> = {
  IDLE:       'text-gray-400',
  DESCENDING: 'text-blue-500',
  BOTTOM:     'text-violet-600 font-black',
  ASCENDING:  'text-emerald-500',
  COMPLETE:   'text-green-500',
};

const SCORE_COLOR = (s: number) =>
  s >= 90 ? 'text-emerald-500' :
  s >= 75 ? 'text-green-500' :
  s >= 50 ? 'text-amber-500' : 'text-red-500';

// ── Angle gauge ─────────────────────────────────────────────────────────────

function AngleGauge({
  label, value, ideal, unit = '°',
}: {
  label: string; value: number; ideal: { min: number; max: number }; unit?: string;
}) {
  const inRange = value >= ideal.min && value <= ideal.max;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-gray-400 font-semibold">{label}</span>
      <span className={`text-lg font-black tabular-nums ${inRange ? 'text-emerald-500' : 'text-amber-500'}`}>
        {value}{unit}
      </span>
      <span className="text-[9px] text-gray-400">
        理想 {ideal.min}–{ideal.max}{unit}
      </span>
    </div>
  );
}

// ── Feedback card ───────────────────────────────────────────────────────────

function FeedbackCard({ fb }: { fb: RepFeedback }) {
  const notes = [fb.kneeNote, fb.hipNote, fb.trunkNote, fb.shinNote].filter(Boolean);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-3.5 animate-slide-in-up">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-black text-gray-500 uppercase tracking-widest">最新レップ</span>
        <span className={`text-2xl font-black tabular-nums ${SCORE_COLOR(fb.score)}`}>{fb.score}<span className="text-xs ml-0.5">点</span></span>
      </div>
      <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">{fb.overall}</p>
      {notes.length > 0 && (
        <ul className="space-y-1">
          {notes.map((n, i) => (
            <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex gap-1.5">
              <span className="text-amber-400 shrink-0">▸</span>{n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function FormPage() {
  const router = useRouter();

  // refs
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number>(0);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const drawingRef    = useRef<DrawingUtils | null>(null);
  const analyzerRef   = useRef(new SquatAnalyzer());
  const lastTimeRef   = useRef(-1);

  // state
  const [running,    setRunning]    = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [sqState,    setSqState]    = useState<SquatAnalyzerState | null>(null);
  const [history,    setHistory]    = useState<RepFeedback[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [customForm, setCustomForm] = useState<SquatIdealForm>(DEFAULT_IDEAL_FORM);

  // ── Load MediaPipe ────────────────────────────────────────────────────────

  const initLandmarker = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { PoseLandmarker, FilesetResolver, DrawingUtils } =
        await import('@mediapipe/tasks-vision');

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
      );

      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses:    1,
      });

      landmarkerRef.current = landmarker;

      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')!;
        drawingRef.current = new DrawingUtils(ctx);
      }
    } catch (e) {
      setError('MediaPipeの読み込みに失敗しました。ネットワーク接続を確認してください。');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Camera ───────────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    if (!landmarkerRef.current) await initLandmarker();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setRunning(true);
      }
    } catch {
      setError('カメラへのアクセスが拒否されました');
    }
  }, [initLandmarker]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    cancelAnimationFrame(rafRef.current);
    setRunning(false);
    lastTimeRef.current = -1;
  }, []);

  // ── Inference loop ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!running) return;

    const loop = (time: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (!videoRef.current || !canvasRef.current || !landmarkerRef.current) return;
      if (videoRef.current.readyState < 2) return;
      if (time === lastTimeRef.current) return;
      lastTimeRef.current = time;

      const video  = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;

      const results = landmarkerRef.current.detectForVideo(video, time);
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.landmarks.length > 0) {
        const lms = results.landmarks[0];

        // Draw skeleton using connections from the landmarker itself
        if (drawingRef.current && landmarkerRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const connections = (landmarkerRef.current.constructor as any).POSE_CONNECTIONS;
          drawingRef.current.drawConnectors(
            lms,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            connections as any,
            { color: '#22c55e', lineWidth: 2 },
          );
          drawingRef.current.drawLandmarks(lms, {
            color: '#fff', fillColor: '#22c55e', lineWidth: 1, radius: 4,
          });
        }

        // Feed to analyzer
        const state = analyzerRef.current.process(lms);
        setSqState(state);

        if (state.feedback) {
          setHistory(prev => {
            if (prev[0] === state.feedback) return prev;
            return [state.feedback!, ...prev].slice(0, 5);
          });
        }
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running]);

  // cleanup on unmount
  useEffect(() => () => { stopCamera(); }, [stopCamera]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = () => {
    analyzerRef.current.reset();
    setSqState(null);
    setHistory([]);
  };

  // ── Custom form apply ─────────────────────────────────────────────────────

  const applyCustomForm = () => {
    analyzerRef.current.updateIdealForm(customForm);
    setShowCustom(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const cardCls = 'bg-white dark:bg-gray-800 rounded-3xl border border-gray-50 dark:border-gray-700 p-4 shadow-[0_4px_16px_rgb(0,0,0,0.04)]';

  return (
    <div className="max-w-md lg:max-w-2xl mx-auto pb-28 lg:pb-8 px-4 lg:px-6 bg-[var(--background)] min-h-screen">

      {/* Header */}
      <div className="flex items-center gap-3 pt-6 pb-4">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-center text-gray-500 hover:scale-105 active:scale-95 transition-all"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <Activity size={22} className="text-violet-500" />
            フォームチェッカー
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">スクワット — リアルタイム解析</p>
        </div>
        <button
          onClick={handleReset}
          className="ml-auto p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
          title="リセット"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Camera / Canvas */}
      <div className={`${cardCls} mb-3 overflow-hidden p-0`}>
        <div className="relative bg-gray-900 rounded-3xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
            muted playsInline
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full scale-x-[-1]"
          />

          {/* Phase overlay */}
          {sqState && running && (
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5">
              <span className={`text-sm font-black ${PHASE_COLOR[sqState.phase] ?? 'text-white'}`}>
                {PHASE_LABEL[sqState.phase]}
              </span>
            </div>
          )}

          {/* Rep count overlay */}
          {sqState && running && (
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center">
              <div className="text-2xl font-black text-white tabular-nums leading-none">{sqState.repCount}</div>
              <div className="text-[10px] text-gray-400">rep</div>
            </div>
          )}

          {/* Idle state */}
          {!running && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Camera size={40} className="text-gray-600" />
              <p className="text-gray-400 text-sm font-semibold">カメラを起動してください</p>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">AIモデルを読み込み中…</p>
            </div>
          )}
        </div>

        {/* Camera controls */}
        <div className="flex gap-2 p-3">
          <button
            onClick={running ? stopCamera : startCamera}
            disabled={loading}
            className={`
              flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all
              ${running
                ? 'bg-red-50 dark:bg-red-900/20 text-red-500 border border-red-100 dark:border-red-800 hover:bg-red-100'
                : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-[0_4px_12px_rgba(139,92,246,0.35)] hover:opacity-90'}
              disabled:opacity-50
            `}
          >
            {running ? <><CameraOff size={16} />停止</> : <><Camera size={16} />カメラ起動</>}
          </button>
          <button
            onClick={() => setShowCustom(v => !v)}
            className="px-4 py-3 rounded-2xl text-sm font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-all"
          >
            <Upload size={16} />
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-500 px-4 pb-3">{error}</p>
        )}
      </div>

      {/* Angle gauges */}
      {sqState && (
        <div className={`${cardCls} mb-3`}>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">リアルタイム関節角度</p>
          <div className="grid grid-cols-4 gap-2">
            <AngleGauge label="膝"   value={sqState.angles.knee}  ideal={customForm.kneeAngle} />
            <AngleGauge label="股関節" value={sqState.angles.hip}   ideal={customForm.hipAngle} />
            <AngleGauge label="体幹傾き" value={sqState.angles.trunk} ideal={customForm.trunkLean} />
            <AngleGauge label="脛"   value={sqState.angles.shin}  ideal={customForm.shinAngle} />
          </div>
          <p className="text-[9px] text-gray-300 dark:text-gray-600 mt-2 text-right">
            Kalmanフィルタ適用済み
          </p>
        </div>
      )}

      {/* How to use */}
      {!sqState && (
        <div className={`${cardCls} mb-3`}>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Info size={12} />
            使い方
          </p>
          <ol className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
            <li>1. カメラを起動（横から全身が映るよう設置）</li>
            <li>2. スクワットを行うと自動でレップカウント開始</li>
            <li>3. 各レップ後にフォームスコアとフィードバックが表示されます</li>
            <li>4. 設定ボタン（↑右）でボトムポジションの理想角度をカスタマイズ可能</li>
          </ol>
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <p className="text-[10px] text-gray-400 font-semibold mb-1">解析アルゴリズム</p>
            <p className="text-[10px] text-gray-400">
              Kalmanフィルタ（ノイズ除去）+ 5フェーズ状態機械（IDLE→DESCENDING→BOTTOM→ASCENDING→COMPLETE）+ 関節角度ベースのフォーム評価
            </p>
          </div>
        </div>
      )}

      {/* Latest feedback */}
      {history.length > 0 && (
        <div className="mb-3">
          <FeedbackCard fb={history[0]} />
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className={`${cardCls} mb-3`}>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">過去のレップ</p>
          <div className="flex gap-2 flex-wrap">
            {history.slice(1).map((fb, i) => (
              <div
                key={i}
                className={`px-3 py-1.5 rounded-full text-xs font-black ${SCORE_COLOR(fb.score)} bg-gray-50 dark:bg-gray-700`}
              >
                {fb.score}点
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom ideal form panel */}
      {showCustom && (
        <div className={`${cardCls} mb-3`}>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
            理想フォームのカスタマイズ
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            プロの動画をMediaPipeで解析した数値、または自身のベストフォームの角度を入力してください
          </p>
          {(
            [
              { label: '膝角度（ボトム）',     key: 'kneeAngle' },
              { label: '股関節角度（ボトム）', key: 'hipAngle' },
              { label: '体幹傾き',             key: 'trunkLean' },
              { label: '脛角度',               key: 'shinAngle' },
            ] as const
          ).map(({ label, key }) => (
            <div key={key} className="mb-3">
              <p className="text-xs font-bold text-gray-500 mb-1.5">{label}</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={customForm[key].min}
                  onChange={e => setCustomForm(prev => ({
                    ...prev,
                    [key]: { ...prev[key], min: Number(e.target.value) },
                  }))}
                  className="w-20 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-center"
                />
                <span className="text-xs text-gray-400">〜</span>
                <input
                  type="number"
                  value={customForm[key].max}
                  onChange={e => setCustomForm(prev => ({
                    ...prev,
                    [key]: { ...prev[key], max: Number(e.target.value) },
                  }))}
                  className="w-20 px-2 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-center"
                />
                <span className="text-xs text-gray-400">°</span>
              </div>
            </div>
          ))}
          <button
            onClick={applyCustomForm}
            className="w-full py-2.5 rounded-2xl text-sm font-bold bg-violet-500 text-white hover:bg-violet-600 transition-colors"
          >
            適用する
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
