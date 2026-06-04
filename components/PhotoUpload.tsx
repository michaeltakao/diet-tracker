'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Upload, Camera, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { postJson } from '@/lib/httpClient';

interface AnalysisResult {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  confidence: string;
  notes: string;
}

interface PhotoUploadProps {
  onAnalysisComplete: (result: AnalysisResult, photoDataUrl: string) => void;
}

export default function PhotoUpload({ onAnalysisComplete }: PhotoUploadProps) {
  const { t } = useLanguage();
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const analyzeImage = async () => {
    if (!preview) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // Extract base64 data and mime type from data URL
      const [header, base64Data] = preview.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';

      const analysisResult = await postJson<AnalysisResult>('/api/analyze-food', {
        imageBase64: base64Data,
        mimeType,
      });
      setResult(analysisResult);
      onAnalysisComplete(analysisResult, preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confidenceLabel = (conf: string): string => {
    if (conf === 'high') return t.high;
    if (conf === 'medium') return t.medium;
    if (conf === 'low') return t.low;
    return conf;
  };

  return (
    <div className="space-y-4">
      {!preview ? (
        <div
          role="button"
          tabIndex={0}
          aria-label={t.dropzoneText.replace('\n', ' ')}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
            isDragging
              ? 'border-brand bg-brand-50 dark:bg-brand-900/20'
              : 'border-line-strong hover:border-brand hover:bg-surface-2'
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center" aria-hidden="true">
              <Camera size={28} className="text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              {t.dropzoneText.split('\n').map((line, i) => (
                <p key={i} className={i === 0 ? 'text-sm font-medium text-muted' : 'text-xs text-faint mt-0.5'}>
                  {line}
                </p>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-faint">
              <Upload size={12} aria-hidden="true" />
              <span>JPEG, PNG, WebP supported</span>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative h-52">
            {/* Object/data-URL preview: optimizer can't process it, so fill the
                fixed-height parent and render unoptimized. */}
            <Image
              src={preview}
              alt="Food preview"
              fill
              unoptimized
              sizes="100vw"
              className="object-cover rounded-2xl"
            />
            <button
              onClick={reset}
              aria-label={t.cancel}
              className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/75 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {t.cancel}
            </button>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl p-3 text-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div role="status" className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-xl p-3 text-sm">
              <CheckCircle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-medium">{t.aiResult} ({t.confidence}: {confidenceLabel(result.confidence)})</p>
                {result.notes && <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">{result.notes}</p>}
              </div>
            </div>
          )}

          {!result && (
            <button
              onClick={analyzeImage}
              disabled={isAnalyzing}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ring)]"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  {t.analyzing}
                </>
              ) : (
                <>
                  <Camera size={18} aria-hidden="true" />
                  {t.analyzeAI}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
