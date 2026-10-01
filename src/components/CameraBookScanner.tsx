import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  X,
  Check,
  Image as ImageIcon,
  FlipHorizontal,
  Sparkles,
  AlertCircle,
  Zap,
  Globe,
  Eye,
  Touchpad,
} from 'lucide-react';
import { AudioLanguageTrack } from '../types';

interface CameraBookScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptureAndTranslate: (
    imageBase64: string,
    mimeType: string,
    preferredAudioTrack?: AudioLanguageTrack
  ) => void;
  isLoading: boolean;
  pageNumber?: number;
}

export const CameraBookScanner: React.FC<CameraBookScannerProps> = ({
  isOpen,
  onClose,
  onCaptureAndTranslate,
  isLoading,
  pageNumber,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevImageDataRef = useRef<ImageData | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const stabilityCounterRef = useRef<number>(0);
  const cameraReadyTimeRef = useRef<number>(0);

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Auto-detection states
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(true);
  const [detectionState, setDetectionState] = useState<'searching' | 'text_detected' | 'capturing'>('searching');
  const [detectionProgress, setDetectionProgress] = useState(0); // 0 to 100
  const [preferredTrack, setPreferredTrack] = useState<AudioLanguageTrack>('catalan');
  const [flashEffect, setFlashEffect] = useState(false);
  const [tapCoords, setTapCoords] = useState<{ x: number; y: number } | null>(null);

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping track', e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Start live camera stream
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setCameraError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
          cameraReadyTimeRef.current = performance.now();
          setCameraActive(true);
        };
        try {
          await videoRef.current.play();
          cameraReadyTimeRef.current = performance.now();
          setCameraActive(true);
        } catch (playErr) {
          console.warn('Video play error on start:', playErr);
        }
      }
    } catch (err: any) {
      console.warn('Camera access issue:', err);
      setCameraError(
        'No s’ha pogut accedir a la càmera directa. Podeu carregar una foto de la pàgina o revisar els permisos del navegador.'
      );
      setCameraActive(false);
    }
  }, []);

  // Whenever modal opens or pageNumber changes, reset previous state and start camera fresh
  useEffect(() => {
    if (isOpen) {
      setCapturedImage(null);
      setDetectionState('searching');
      setDetectionProgress(0);
      stabilityCounterRef.current = 0;
      prevImageDataRef.current = null;
      cameraReadyTimeRef.current = performance.now();
      startCamera(facingMode);
    } else {
      setCapturedImage(null);
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, pageNumber, facingMode, startCamera, stopCamera]);

  // Flip camera (environment <-> user)
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Perform full-resolution snapshot
  const takeSnapshot = useCallback(() => {
    const video = videoRef.current;
    if (!video) return null;
    const w = video.videoWidth || video.clientWidth || 1280;
    const h = video.videoHeight || video.clientHeight || 720;
    if (w <= 0 || h <= 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(dataUrl);

    // Flash animation
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 300);

    stopCamera();
    return dataUrl;
  }, [stopCamera]);

  // Automatic snapshot and instant narration trigger
  const triggerAutoCapture = useCallback(() => {
    setDetectionState('capturing');
    const snapshot = takeSnapshot();
    if (snapshot) {
      onCaptureAndTranslate(snapshot, 'image/jpeg', preferredTrack);
    }
  }, [takeSnapshot, onCaptureAndTranslate, preferredTrack]);

  // Viewfinder Click/Tap to capture directly on top of the image
  const handleViewfinderTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('label') || target.closest('input')) {
      return;
    }
    if (!cameraActive || capturedImage || isLoading) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setTapCoords({ x, y });
    setTimeout(() => setTapCoords(null), 600);

    const snapshot = takeSnapshot();
    if (snapshot) {
      onCaptureAndTranslate(snapshot, 'image/jpeg', preferredTrack);
    }
  };

  // Real-time Text Detection & Stability Engine
  useEffect(() => {
    if (!isOpen || !cameraActive || capturedImage || !autoDetectEnabled || isLoading) {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      return;
    }

    if (!analysisCanvasRef.current) {
      analysisCanvasRef.current = document.createElement('canvas');
      analysisCanvasRef.current.width = 160;
      analysisCanvasRef.current.height = 120;
    }

    const canvas = analysisCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let lastTime = performance.now();

    const analyzeLoop = () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrameIdRef.current = requestAnimationFrame(analyzeLoop);
        return;
      }

      // Warmup check: wait at least 800ms after camera start before auto-capture
      if (performance.now() - cameraReadyTimeRef.current < 800) {
        stabilityCounterRef.current = 0;
        animFrameIdRef.current = requestAnimationFrame(analyzeLoop);
        return;
      }

      const now = performance.now();
      const delta = now - lastTime;

      // Sample every ~120ms to save CPU
      if (delta > 120) {
        lastTime = now;
        const w = 160;
        const h = 120;
        ctx.drawImage(videoRef.current, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        let totalDiff = 0;
        let textTransitions = 0;
        let totalLum = 0;
        const prev = prevImageDataRef.current;

        // Sample interior area (target box)
        for (let y = 15; y < h - 15; y += 2) {
          for (let x = 15; x < w - 15; x += 2) {
            const idx = (y * w + x) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            totalLum += lum;

            if (prev) {
              const prevLum =
                0.299 * prev.data[idx] + 0.587 * prev.data[idx + 1] + 0.114 * prev.data[idx + 2];
              totalDiff += Math.abs(lum - prevLum);
            }

            // Contrast edge detection (printed text line alternating transitions)
            const rightIdx = (y * w + (x + 2)) * 4;
            const rightLum =
              0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
            if (Math.abs(lum - rightLum) > 28) {
              textTransitions++;
            }
          }
        }

        const samplePoints = ((h - 30) / 2) * ((w - 30) / 2);
        const avgLum = totalLum / samplePoints;
        const motionScore = prev ? totalDiff / samplePoints : 100;
        const textDensity = textTransitions / samplePoints;
        prevImageDataRef.current = imgData;

        // Book Page Criteria:
        // 1. Decent light: avgLum between 45 and 245
        // 2. High horizontal text transitions: textDensity > 0.12
        // 3. Motion stability: motionScore < 11 (not waving or shaking)
        const hasTextPattern = avgLum > 45 && avgLum < 245 && textDensity > 0.12;
        const isSteady = motionScore < 11;

        if (hasTextPattern && isSteady) {
          // Increase lock-in counter
          stabilityCounterRef.current = Math.min(100, stabilityCounterRef.current + 20);
          setDetectionState('text_detected');
          setDetectionProgress(stabilityCounterRef.current);

          if (stabilityCounterRef.current >= 100) {
            triggerAutoCapture();
            return;
          }
        } else if (hasTextPattern && !isSteady) {
          // Text detected but moving/unstable
          stabilityCounterRef.current = Math.max(15, stabilityCounterRef.current - 10);
          setDetectionState('text_detected');
          setDetectionProgress(stabilityCounterRef.current);
        } else {
          // No text in frame or too dark
          stabilityCounterRef.current = Math.max(0, stabilityCounterRef.current - 25);
          if (stabilityCounterRef.current === 0) {
            setDetectionState('searching');
          }
          setDetectionProgress(stabilityCounterRef.current);
        }
      }

      animFrameIdRef.current = requestAnimationFrame(analyzeLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(analyzeLoop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [isOpen, cameraActive, capturedImage, autoDetectEnabled, isLoading, triggerAutoCapture]);

  // Upload or photo from gallery / mobile camera input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCapturedImage(dataUrl);
        stopCamera();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmAndTranslate = () => {
    if (!capturedImage) return;
    const img = capturedImage;
    setCapturedImage(null);
    onCaptureAndTranslate(img, 'image/jpeg', preferredTrack);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setDetectionState('searching');
    setDetectionProgress(0);
    stabilityCounterRef.current = 0;
    prevImageDataRef.current = null;
    startCamera(facingMode);
  };

  const handleClose = () => {
    setCapturedImage(null);
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-stone-900 border border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-stone-100 max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base text-white">
                  {pageNumber ? `Llegint Pàgina ${pageNumber} del llibre` : 'Lectura & Traducció Automàtica de Llibres'}
                </h3>
                {pageNumber && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                    Pàg. {pageNumber}
                  </span>
                )}
                {autoDetectEnabled && !capturedImage && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-400" />
                    Auto-Lectura Activa
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400">
                Apunta al text del llibre o toca directament la pantalla per fer la foto
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Feature Bar: Auto-Detect Toggle & Target Voice Track */}
        <div className="px-5 py-2.5 bg-stone-950/80 border-b border-stone-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Auto-detect Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-stone-400 font-sans">Detecció automàtica:</span>
            <button
              onClick={() => {
                setAutoDetectEnabled(!autoDetectEnabled);
                setDetectionProgress(0);
                stabilityCounterRef.current = 0;
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                autoDetectEnabled
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-stone-800 text-stone-400 hover:text-stone-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{autoDetectEnabled ? 'Auto-lectura ACTIVA' : 'Manual (Toca pantalla)'}</span>
            </button>
          </div>

          {/* Preferred Reading Language Track Toggle */}
          <div className="flex items-center gap-1 bg-stone-900 p-0.5 rounded-lg border border-stone-800">
            <span className="text-[11px] text-stone-400 px-2">Veu:</span>
            <button
              onClick={() => setPreferredTrack('catalan')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                preferredTrack === 'catalan'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              En Català
            </button>
            <button
              onClick={() => setPreferredTrack('original')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                preferredTrack === 'original'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Idioma Natural</span>
            </button>
          </div>
        </div>

        {/* Viewfinder Area: Clicking/Tapping anywhere snaps photo */}
        <div
          onClick={handleViewfinderTap}
          className={`relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[340px] sm:min-h-[420px] select-none ${
            cameraActive && !capturedImage ? 'cursor-pointer' : ''
          }`}
          title={cameraActive && !capturedImage ? 'Clica a sobre de la imatge per fer la foto directament' : undefined}
        >
          {/* Flash Effect on capture */}
          {flashEffect && <div className="absolute inset-0 bg-white z-40 opacity-80 pointer-events-none animate-out fade-out duration-300" />}

          {/* Tap ripple target feedback */}
          {tapCoords && (
            <div
              className="absolute pointer-events-none z-30 flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
              style={{ left: tapCoords.x, top: tapCoords.y }}
            >
              <div className="w-20 h-20 rounded-full border-2 border-amber-400 bg-amber-400/25 animate-ping" />
              <div className="absolute w-10 h-10 rounded-full border-2 border-white bg-white/20" />
            </div>
          )}

          {/* Video element is permanently mounted */}
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover max-h-[460px] ${capturedImage ? 'hidden' : 'block'}`}
          />

          {/* Snapshot Preview if user manually snapped or uploaded photo */}
          {capturedImage ? (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img
                src={capturedImage}
                alt="Pàgina capturada"
                className="max-h-[380px] sm:max-h-[460px] max-w-full object-contain rounded-xl shadow-lg border border-stone-800"
              />
              <div className="absolute top-6 left-6 px-3 py-1 rounded-full bg-stone-900/80 backdrop-blur-md text-amber-400 text-xs font-medium border border-amber-500/40 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Pàgina capturada correctament</span>
              </div>
            </div>
          ) : (
            /* Live Camera Dynamic Overlay */
            cameraActive && (
              <>
                <div
                  className={`absolute inset-8 sm:inset-12 border-2 rounded-2xl pointer-events-none flex flex-col justify-between p-4 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] transition-all duration-300 ${
                    detectionState === 'capturing'
                      ? 'border-emerald-400 bg-emerald-500/10 scale-102 ring-4 ring-emerald-400/40'
                      : detectionState === 'text_detected'
                      ? 'border-emerald-400 border-solid ring-2 ring-emerald-400/50'
                      : 'border-dashed border-amber-400/70'
                  }`}
                >
                  {/* Top Target Status Banner */}
                  <div className="flex justify-between items-start">
                    <span
                      className={`w-4 h-4 border-t-2 border-l-2 transition-colors ${
                        detectionState === 'text_detected' ? 'border-emerald-400' : 'border-amber-400'
                      }`}
                    ></span>

                    <div className="flex flex-col items-center gap-1">
                      {autoDetectEnabled ? (
                        <div
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-full backdrop-blur-md font-sans text-xs font-semibold shadow-md transition-all ${
                            detectionState === 'capturing'
                              ? 'bg-emerald-600 text-white animate-pulse'
                              : detectionState === 'text_detected'
                              ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/60'
                              : 'bg-stone-900/90 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {detectionState === 'capturing' ? (
                            <>
                              <Sparkles className="w-3.5 h-3.5 animate-spin" />
                              <span>Pàgina detectada! Iniciant lectura...</span>
                            </>
                          ) : detectionState === 'text_detected' ? (
                            <>
                              <Eye className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                              <span>Text detectat! Mantén la càmera quieta ({detectionProgress}%)</span>
                            </>
                          ) : (
                            <>
                              <Camera className="w-3.5 h-3.5 text-amber-400" />
                              <span>Enquadra el text del llibre</span>
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] font-sans px-2.5 py-0.5 rounded-full bg-stone-900/85 text-amber-300 font-semibold tracking-wide border border-amber-500/30">
                          Toca la pantalla o el botó per disparar
                        </span>
                      )}

                      {/* Auto-detect Stability Progress Bar */}
                      {autoDetectEnabled && detectionProgress > 0 && (
                        <div className="w-36 h-1.5 bg-stone-900/80 rounded-full overflow-hidden border border-emerald-500/40">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-150"
                            style={{ width: `${detectionProgress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>

                    <span
                      className={`w-4 h-4 border-t-2 border-r-2 transition-colors ${
                        detectionState === 'text_detected' ? 'border-emerald-400' : 'border-amber-400'
                      }`}
                    ></span>
                  </div>

                  {/* Bottom Corners */}
                  <div className="flex justify-between items-end">
                    <span
                      className={`w-4 h-4 border-b-2 border-l-2 transition-colors ${
                        detectionState === 'text_detected' ? 'border-emerald-400' : 'border-amber-400'
                      }`}
                    ></span>
                    <span
                      className={`w-4 h-4 border-b-2 border-r-2 transition-colors ${
                        detectionState === 'text_detected' ? 'border-emerald-400' : 'border-amber-400'
                      }`}
                    ></span>
                  </div>
                </div>

                {/* Helpful Instruction Pill: Tap image directly to shoot */}
                <div className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none z-20">
                  <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-stone-950/85 backdrop-blur-md text-amber-300 text-xs font-semibold border border-amber-500/40 shadow-xl">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span>Toca qualsevol punt de la imatge per fer la foto</span>
                  </div>
                </div>
              </>
            )
          )}

          {/* Error fallback message if camera is blocked */}
          {cameraError && (
            <div className="absolute inset-6 bg-stone-900/95 border border-stone-800 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-4 z-20">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-xs text-stone-300 max-w-md">{cameraError}</p>
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs shadow-md transition cursor-pointer">
                <ImageIcon className="w-4 h-4" />
                <span>Seleccionar foto o fer foto amb mòbil</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Flip camera button */}
          {!capturedImage && cameraActive && (
            <button
              onClick={toggleFacingMode}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-stone-900/70 hover:bg-stone-800 text-stone-300 hover:text-white backdrop-blur-md transition cursor-pointer border border-stone-700/50 z-20"
              title="Canviar entre càmera posterior i frontal"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Controls Toolbar */}
        <div className="px-5 py-4 bg-stone-900/90 border-t border-stone-800 flex flex-wrap items-center justify-between gap-3">
          {capturedImage ? (
            /* Review & Submit Actions */
            <div className="w-full flex items-center justify-between gap-3">
              <button
                onClick={handleRetake}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-medium transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tornar a enfocar</span>
              </button>

              <button
                onClick={handleConfirmAndTranslate}
                disabled={isLoading}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-xs sm:text-sm shadow-md transition cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Llegint i traduint la pàgina...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Traduir i Narrar aquesta Pàgina</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Live Camera Trigger Controls */
            <div className="w-full flex items-center justify-between gap-3">
              {/* File upload alternative */}
              <label className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 bg-stone-800/80 hover:bg-stone-800 border border-stone-700 px-3 py-2 rounded-xl transition cursor-pointer">
                <ImageIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pujar foto de la galeria</span>
                <span className="sm:hidden">Galeria</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {/* Shutter Button (Manual Override) */}
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={triggerAutoCapture}
                  disabled={!cameraActive || isLoading}
                  className={`w-14 h-14 rounded-full border-4 p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition cursor-pointer disabled:opacity-40 ${
                    detectionState === 'text_detected'
                      ? 'border-emerald-400 shadow-lg shadow-emerald-500/20'
                      : 'border-amber-500'
                  }`}
                  title="Fer la foto ara mateix"
                >
                  <div
                    className={`w-10 h-10 rounded-full transition-colors ${
                      detectionState === 'text_detected'
                        ? 'bg-emerald-400 hover:bg-emerald-300'
                        : 'bg-amber-400 hover:bg-amber-300'
                    }`}
                  ></div>
                </button>
                <span className="text-[10px] text-stone-400">
                  {autoDetectEnabled ? 'O toca la imatge' : 'Capturar'}
                </span>
              </div>

              <div className="text-right text-[11px] text-stone-400 font-sans">
                <span className="text-stone-300 font-medium block">
                  👆 Toca imatge per disparar
                </span>
                <span className="block text-[10px] text-stone-500">Multimodal Gemini 3.8</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
