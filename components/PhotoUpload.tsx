'use client';

import { useState, useRef, useCallback } from 'react';
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
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-green-500 bg-green-50'
              : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
          }`}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <Camera size={28} className="text-green-600" />
            </div>
            <div>
              {t.dropzoneText.split('\n').map((line, i) => (
                <p key={i} className={i === 0 ? 'text-sm font-medium text-gray-700' : 'text-xs text-gray-500 mt-0.5'}>
                  {line}
                </p>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Upload size={12} />
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
          <div className="relative">
            <img
              src={preview}
              alt="Food preview"
              className="w-full h-52 object-cover rounded-2xl"
            />
            <button
              onClick={reset}
              className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-lg hover:bg-black/70 transition-colors"
            >
              {t.cancel}
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-xl p-3 text-sm">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="flex items-start gap-2 bg-green-50 text-green-700 rounded-xl p-3 text-sm">
              <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{t.aiResult} ({t.confidence}: {confidenceLabel(result.confidence)})</p>
                {result.notes && <p className="text-xs text-green-600 mt-0.5">{result.notes}</p>}
              </div>
            </div>
          )}

          {!result && (
            <button
              onClick={analyzeImage}
              disabled={isAnalyzing}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t.analyzing}
                </>
              ) : (
                <>
                  <Camera size={18} />
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
