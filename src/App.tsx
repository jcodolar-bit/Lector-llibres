import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Volume2,
  Sparkles,
  Upload,
  Globe2,
  Sliders,
  History,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Headphones,
  Feather,
  ArrowRight,
  RefreshCw,
  Camera,
} from 'lucide-react';
import {
  LiteraryTone,
  NarratorVoice,
  NarratorPacing,
  TranslationResult,
  SampleExcerpt,
  AudioLanguageTrack,
  ScannedBookPage,
} from './types';
import { SAMPLE_EXCERPTS } from './data/samples';
import { AudioPlayer } from './components/AudioPlayer';
import { BilingualReader } from './components/BilingualReader';
import { TranslatorNotes } from './components/TranslatorNotes';
import { CameraBookScanner } from './components/CameraBookScanner';
import { BookPageNavigator } from './components/BookPageNavigator';

const SOURCE_LANGUAGES = [
  { value: 'auto', label: '✨ Detecció automàtica d\'idioma' },
  { value: 'Anglès', label: '🇬🇧 Anglès (English)' },
  { value: 'Francès', label: '🇫🇷 Francès (Français)' },
  { value: 'Alemany', label: '🇩🇪 Alemany (Deutsch)' },
  { value: 'Castellà', label: '🇪🇸 Castellà (Español)' },
  { value: 'Italià', label: '🇮🇹 Italià (Italiano)' },
  { value: 'Portuguès', label: '🇵🇹 Portuguès (Português)' },
  { value: 'Rus', label: '🇷🇺 Rus (Русский)' },
  { value: 'Japonès', label: '🇯🇵 Japonès (日本語)' },
  { value: 'Altres', label: '🌐 Altre idioma de partida' },
];

export default function App() {
  const [inputText, setInputText] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [literaryTone, setLiteraryTone] = useState<LiteraryTone>('classic');
  const [voiceName, setVoiceName] = useState<NarratorVoice>('Kore');
  const [pacing, setPacing] = useState<NarratorPacing>('natural');

  const [isLoading, setIsLoading] = useState(false);
  const [isRegeneratingAudio, setIsRegeneratingAudio] = useState(false);
  const [isNarratingParagraphId, setIsNarratingParagraphId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeParagraphId, setActiveParagraphId] = useState<number | null>(null);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [history, setHistory] = useState<TranslationResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraScanning, setIsCameraScanning] = useState(false);
  const [currentLanguageTrack, setCurrentLanguageTrack] = useState<AudioLanguageTrack>('catalan');
  const [isLoadingOriginalAudio, setIsLoadingOriginalAudio] = useState(false);
  const [isNarratingOriginalParagraphId, setIsNarratingOriginalParagraphId] = useState<number | null>(null);

  // Book Reading Session: Multi-page management
  const [bookPages, setBookPages] = useState<ScannedBookPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [autoOpenOnAudioEnd, setAutoOpenOnAudioEnd] = useState<boolean>(false);

  // Navigate to an existing page in the current reading session
  const handleSelectBookPage = (index: number) => {
    if (index >= 0 && index < bookPages.length) {
      setCurrentPageIndex(index);
      setResult(bookPages[index]);
      setInputText(bookPages[index].originalText || bookPages[index].extractedOriginalText || '');
      setTimeout(() => {
        const resEl = document.getElementById('results-section');
        if (resEl) {
          resEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  // Trigger camera for next page
  const handleScanNextPage = () => {
    primeAudioContext();
    setIsCameraOpen(true);
  };

  // Auto-advance prompt when audio narration finishes
  const handleAudioEnded = () => {
    if (autoOpenOnAudioEnd && bookPages.length > 0) {
      setTimeout(() => {
        primeAudioContext();
        setIsCameraOpen(true);
      }, 1400);
    }
  };

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('veuliteraria_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load history', e);
    }
  }, []);

  const saveToHistory = (item: TranslationResult) => {
    const updated = [item, ...history.filter((h) => h.catalanTranslation !== item.catalanTranslation)].slice(0, 15);
    setHistory(updated);
    try {
      localStorage.setItem('veuliteraria_history', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save history', e);
    }
  };

  // Clear all history
  const handleClearHistory = () => {
    if (window.confirm('Voleu esborrar tot l\'historial de fragments i narracions desades?')) {
      setHistory([]);
      try {
        localStorage.removeItem('veuliteraria_history');
      } catch (e) {
        console.error('Failed to clear history from storage', e);
      }
      setShowHistory(false);
    }
  };

  // Delete individual item from history
  const handleDeleteHistoryItem = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter((_, i) => i !== index);
    setHistory(updated);
    try {
      localStorage.setItem('veuliteraria_history', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
  };

  // Clear current reading session (pages)
  const handleClearSession = () => {
    if (window.confirm('Voleu reiniciar la sessió de lectura actual i buidar les pàgines?')) {
      setBookPages([]);
      setCurrentPageIndex(0);
      setResult(null);
      setInputText('');
      setActiveParagraphId(null);
    }
  };

  const handleSelectSample = (sample: SampleExcerpt) => {
    setInputText(sample.text);
    setSourceLanguage(sample.language);
    setLiteraryTone(sample.suggestedTone);
    setVoiceName(sample.suggestedVoice);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setInputText(content.trim());
      }
    };
    reader.readAsText(file);
  };

  // Helper to prime/unlock browser audio permissions during direct user interaction
  const primeAudioContext = () => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const audioCtx = new AudioCtxClass();
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }
      }
    } catch {
      // Ignore if not supported
    }
  };

  // Main Submit: Translate and generate native audio
  const handleTranslateAndNarrate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) {
      setErrorMessage('Si us plau, introduïu o enganxeu un fragment literari.');
      return;
    }

    primeAudioContext();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/translate-and-narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText.trim(),
          sourceLanguage,
          literaryTone,
          voiceName,
          narratorPacing: pacing,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error del servidor (${response.status})`);
      }

      const data: TranslationResult = await response.json();
      const firstPage: ScannedBookPage = {
        ...data,
        pageNumber: 1,
      };
      setBookPages([firstPage]);
      setCurrentPageIndex(0);
      setResult(firstPage);
      saveToHistory({ ...firstPage, timestamp: Date.now() });

      // Auto-scroll to results
      setTimeout(() => {
        const resEl = document.getElementById('results-section');
        if (resEl) {
          resEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (err: any) {
      console.error('Processing error:', err);
      setErrorMessage(err.message || 'No s\'ha pogut processar la traducció i narració.');
    } finally {
      setIsLoading(false);
    }
  };

  // Camera Book Capture & Instant Auto-Translate
  const handleCaptureAndTranslate = async (
    imageBase64: string,
    mimeType: string,
    preferredAudioTrack: AudioLanguageTrack = 'catalan'
  ) => {
    primeAudioContext();
    setIsCameraScanning(true);
    setErrorMessage(null);
    setCurrentLanguageTrack(preferredAudioTrack);

    try {
      const response = await fetch('/api/scan-and-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          sourceLanguage,
          literaryTone,
          voiceName,
          narratorPacing: pacing,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error en escanejar la pàgina (${response.status})`);
      }

      const data: TranslationResult = await response.json();
      if (data.extractedOriginalText) {
        setInputText(data.extractedOriginalText);
      }

      const nextPageNumber = bookPages.length + 1;
      const newBookPage: ScannedBookPage = {
        ...data,
        pageNumber: nextPageNumber,
        thumbnailUrl: imageBase64,
      };

      const updatedPages = [...bookPages, newBookPage];
      setBookPages(updatedPages);
      setCurrentPageIndex(updatedPages.length - 1);
      setResult(newBookPage);
      saveToHistory({ ...newBookPage, timestamp: Date.now() });
      setIsCameraOpen(false);

      // If user wanted natural original language track directly, request original audio
      if (preferredAudioTrack === 'original') {
        const origText = data.originalText || data.extractedOriginalText;
        if (origText) {
          setIsLoadingOriginalAudio(true);
          fetch('/api/narrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: origText,
              language: data.detectedLanguage,
              languageCode: data.languageCode,
              voiceName,
              pacing,
            }),
          })
            .then((r) => r.json())
            .then((audioData) => {
              setResult((prev) => (prev ? { ...prev, originalAudio: audioData } : null));
            })
            .catch(console.error)
            .finally(() => setIsLoadingOriginalAudio(false));
        }
      }

      setTimeout(() => {
        const resEl = document.getElementById('results-section');
        if (resEl) {
          resEl.scrollIntoView({ behavior: 'smooth' });
        }
      }, 150);
    } catch (err: any) {
      console.error('Camera processing error:', err);
      setErrorMessage(err.message || 'No s\'ha pogut processar la fotografia del llibre.');
    } finally {
      setIsCameraScanning(false);
    }
  };

  // Switch between Catalan literary translation and Natural Original language audio tracks
  const handleLanguageTrackChange = async (track: AudioLanguageTrack) => {
    primeAudioContext();
    setCurrentLanguageTrack(track);

    if (track === 'original' && result && !result.originalAudio?.audioBase64) {
      const origText = result.originalText || result.extractedOriginalText || inputText;
      if (!origText) return;

      setIsLoadingOriginalAudio(true);
      try {
        const response = await fetch('/api/narrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: origText,
            language: result.detectedLanguage,
            languageCode: result.languageCode,
            voiceName,
            pacing,
          }),
        });

        if (response.ok) {
          const audioData = await response.json();
          setResult((prev) => (prev ? { ...prev, originalAudio: audioData } : null));
        }
      } catch (e) {
        console.error('Failed to generate original speech', e);
      } finally {
        setIsLoadingOriginalAudio(false);
      }
    }
  };

  // Regenerate audio with new voice or pacing for active track
  const handleRegenerateAudio = async () => {
    if (!result) return;
    setIsRegeneratingAudio(true);
    setErrorMessage(null);

    const isOriginal = currentLanguageTrack === 'original';
    const textToNarrate = isOriginal
      ? (result.originalText || result.extractedOriginalText || inputText)
      : result.catalanTranslation;
    const targetLang = isOriginal ? result.detectedLanguage : 'Català';
    const targetLangCode = isOriginal ? result.languageCode : 'ca';

    try {
      const response = await fetch('/api/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToNarrate,
          voiceName,
          pacing,
          language: targetLang,
          languageCode: targetLangCode,
        }),
      });

      if (!response.ok) {
        throw new Error('Error en regenerar la narració d’àudio.');
      }

      const audioData = await response.json();
      setResult((prev) => {
        if (!prev) return null;
        if (isOriginal) {
          return { ...prev, originalAudio: audioData };
        }
        return { ...prev, audio: audioData };
      });
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error en regenerar l’àudio.');
    } finally {
      setIsRegeneratingAudio(false);
    }
  };

  // Narrate single paragraph in original language
  const handleNarrateOriginalParagraph = async (text: string, id: number) => {
    primeAudioContext();
    setIsNarratingOriginalParagraphId(id);
    setActiveParagraphId(id);

    try {
      const response = await fetch('/api/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceName,
          pacing,
          language: result?.detectedLanguage || 'auto',
          languageCode: result?.languageCode || 'en',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.audioBase64) {
          const binary = atob(data.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => {
            setIsNarratingOriginalParagraphId(null);
            URL.revokeObjectURL(url);
          };
          audio.onerror = () => {
            setIsNarratingOriginalParagraphId(null);
            URL.revokeObjectURL(url);
          };
          await audio.play();
          return;
        }
      }
      throw new Error('Fallback to Web Speech');
    } catch {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const code = result?.languageCode || 'en';
        utterance.lang = code;
        const voices = window.speechSynthesis.getVoices();
        const origVoice = voices.find((v) => v.lang.toLowerCase().startsWith(code.slice(0, 2).toLowerCase()));
        if (origVoice) utterance.voice = origVoice;
        utterance.onend = () => setIsNarratingOriginalParagraphId(null);
        utterance.onerror = () => setIsNarratingOriginalParagraphId(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsNarratingOriginalParagraphId(null);
      }
    }
  };

  // Narrate single paragraph
  const handleNarrateParagraph = async (text: string, id: number) => {
    primeAudioContext();
    setIsNarratingParagraphId(id);
    setActiveParagraphId(id);

    try {
      const response = await fetch('/api/narrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceName,
          pacing,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.audioBase64) {
          const binary = atob(data.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'audio/wav' });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => {
            setIsNarratingParagraphId(null);
            URL.revokeObjectURL(url);
          };
          audio.onerror = () => {
            setIsNarratingParagraphId(null);
            URL.revokeObjectURL(url);
          };
          await audio.play();
          return;
        }
      }
      throw new Error('Fallback to Web Speech');
    } catch {
      // Fallback to browser SpeechSynthesis
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ca-ES';
        const voices = window.speechSynthesis.getVoices();
        const catVoice = voices.find(
          (v) =>
            v.lang.startsWith('ca') ||
            v.name.toLowerCase().includes('catalan') ||
            v.name.includes('Jordi') ||
            v.name.includes('Montserrat')
        );
        if (catVoice) utterance.voice = catVoice;
        utterance.onend = () => setIsNarratingParagraphId(null);
        utterance.onerror = () => setIsNarratingParagraphId(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsNarratingParagraphId(null);
      }
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('veuliteraria_history');
  };

  return (
    <div className="min-h-screen bg-stone-100/60 text-stone-900 font-sans flex flex-col selection:bg-amber-200">
      {/* Editorial Header */}
      <header className="border-b border-stone-200/80 bg-stone-900 text-stone-100 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center md:text-left">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 flex items-center justify-center shadow-md">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center md:justify-start">
                <h1 className="font-display text-2xl font-bold tracking-tight text-white">
                  VeuLiterària
                </h1>
                <span className="text-[11px] font-sans px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Català Normatiu
                </span>
              </div>
              <p className="text-xs text-stone-400 font-sans mt-0.5">
                Traductor Literari Professional & Narrador d'Audiollibres en Llengua Catalana
              </p>
            </div>
          </div>

          {/* Quick Action Badges */}
          <div className="flex items-center gap-2 text-xs font-sans">
            <button
              onClick={() => setIsCameraOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-stone-950 font-bold transition shadow-sm cursor-pointer active:scale-95"
              title="Llegir pàgina de llibre amb la càmera"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Llegir amb Càmera</span>
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Model TTS 24kHz</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
              <Feather className="w-3.5 h-3.5 text-amber-400" />
              <span>Estil Literari Genuí</span>
            </span>
            {history.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition cursor-pointer text-xs"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Historial ({history.length})</span>
                </button>
                <button
                  onClick={handleClearHistory}
                  className="p-1.5 rounded-full bg-stone-800 hover:bg-red-950/80 text-stone-400 hover:text-red-400 border border-stone-700 transition cursor-pointer"
                  title="Esborrar tot l'historial guardat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* History drawer if opened */}
        {showHistory && history.length > 0 && (
          <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm space-y-4 transition-all">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-600" />
                <h3 className="font-semibold text-sm text-stone-900">Fragments i Narracions Anteriors</h3>
              </div>
              <button
                onClick={handleClearHistory}
                className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1 transition cursor-pointer px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Esborrar tot l'historial</span>
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {history.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setResult(item);
                    setBookPages([{ ...item, pageNumber: item.pageNumber || 1 }]);
                    setCurrentPageIndex(0);
                    setShowHistory(false);
                  }}
                  className="relative p-3.5 rounded-xl border border-stone-200/80 hover:border-amber-400 hover:bg-amber-50/30 transition cursor-pointer text-left group"
                >
                  <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                    <span className="font-semibold text-amber-800">{item.detectedLanguage}</span>
                    <div className="flex items-center gap-1.5">
                      <span>{item.detectedGenre || 'Fragment'}</span>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteHistoryItem(idx, e)}
                        className="opacity-60 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-stone-400 hover:text-red-600 transition cursor-pointer"
                        title="Esborrar aquest element de l'historial"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs font-serif text-stone-800 line-clamp-2">
                    {item.catalanTranslation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Translation Input Studio */}
        <section className="bg-white/80 backdrop-blur-sm rounded-2xl border border-stone-200/90 shadow-sm p-6 sm:p-8">
          <form onSubmit={handleTranslateAndNarrate} className="space-y-6">
            {/* Top Toolbar: Samples & File Upload */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 font-sans mb-1">
                  1. Fragment de llibre o text original
                </label>
                <p className="text-xs text-stone-500 font-sans">
                  Enganxeu un passatge, carregueu un document o trieu una obra clàssica:
                </p>
              </div>

              {/* Camera & File upload buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-stone-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 border border-amber-500 font-bold px-3.5 py-1.5 rounded-lg shadow-xs transition-all cursor-pointer active:scale-95"
                  title="Enfoca la pàgina d'un llibre físic amb la càmera per traduir-la i narrar-la directament"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Llegir pàgina amb la Càmera</span>
                </button>

                <label className="flex items-center gap-1.5 text-xs text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/80 border border-stone-200 px-3 py-1.5 rounded-lg transition cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Carregar fitxer (.txt / .md)</span>
                  <input
                    type="file"
                    accept=".txt,.md,.text"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Quick Sample Excerpts */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
              <span className="text-stone-400 font-medium whitespace-nowrap text-[11px] mr-1">
                Exemples:
              </span>
              {SAMPLE_EXCERPTS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSample(sample)}
                  className="px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 whitespace-nowrap text-xs transition cursor-pointer active:scale-95"
                >
                  {sample.title} ({sample.languageCode.toUpperCase()})
                </button>
              ))}
            </div>

            {/* Textarea */}
            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Escriviu o enganxeu aquí el text de l'obra en qualsevol idioma (anglès, francès, alemany, castellà, italià, etc.)..."
                rows={6}
                className="w-full p-4 rounded-xl border border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200/60 font-serif text-base text-stone-900 placeholder:text-stone-400 focus:outline-none transition resize-y leading-relaxed bg-stone-50/30"
              />
              <div className="absolute right-3 bottom-3 text-[11px] text-stone-400 font-sans">
                {inputText.length} caràcters · {inputText.trim() ? inputText.trim().split(/\s+/).length : 0} paraules
              </div>
            </div>

            {/* Settings Row: Source Language, Literary Register, Voice & Pacing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-stone-50 border border-stone-200/70 text-xs">
              {/* Source Language */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                  <Globe2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Idioma d'origen</span>
                </label>
                <select
                  value={sourceLanguage}
                  onChange={(e) => setSourceLanguage(e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-2 text-stone-800 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                >
                  {SOURCE_LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Literary Tone */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                  <Feather className="w-3.5 h-3.5 text-amber-600" />
                  <span>Registre literari</span>
                </label>
                <select
                  value={literaryTone}
                  onChange={(e) => setLiteraryTone(e.target.value as LiteraryTone)}
                  className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-2 text-stone-800 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="classic">Clàssic & Dignificat (Pla, Carner)</option>
                  <option value="contemporary">Contemporani fluid & viu</option>
                  <option value="poetic">Poètic & Evocador (Líric)</option>
                  <option value="theatrical">Teatral & Dramàtic (Diàlegs)</option>
                </select>
              </div>

              {/* Narrator Voice */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                  <Headphones className="w-3.5 h-3.5 text-amber-600" />
                  <span>Veu de narrador (Gemini TTS)</span>
                </label>
                <select
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value as NarratorVoice)}
                  className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-2 text-stone-800 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="Kore">Kore — Veu femenina càlida i nítida</option>
                  <option value="Fenrir">Fenrir — Veu masculina profunda i greu</option>
                  <option value="Puck">Puck — Veu dinàmica i viva</option>
                  <option value="Zephyr">Zephyr — Veu serena i reposada</option>
                  <option value="Charon">Charon — Veu solemne i dramàtica</option>
                </select>
              </div>

              {/* Pacing */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-amber-600" />
                  <span>Ritme i pauses de lectura</span>
                </label>
                <select
                  value={pacing}
                  onChange={(e) => setPacing(e.target.value as NarratorPacing)}
                  className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-2 text-stone-800 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="natural">Natural d'audiollibre professional</option>
                  <option value="contemplative">Pausat & Reflexiu (pauses marcades)</option>
                  <option value="dramatic">Dramàtic & Tens (intensitat escènica)</option>
                </select>
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Sense introduccions ni comiats afegits · Lectura directa del text</span>
              </div>

              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Traduïnt i generant àudio en català...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Traduir i Generar Narració d'Àudio</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Results Section */}
        {result && (
          <section id="results-section" className="space-y-6 pt-2">
            {/* Book Page Navigator for multi-page reading */}
            {bookPages.length > 0 && (
              <BookPageNavigator
                pages={bookPages}
                currentPageIndex={currentPageIndex}
                onSelectPage={handleSelectBookPage}
                onScanNextPage={handleScanNextPage}
                autoOpenOnAudioEnd={autoOpenOnAudioEnd}
                onToggleAutoOpenOnAudioEnd={setAutoOpenOnAudioEnd}
                onClearSession={handleClearSession}
              />
            )}

            {result.extractedOriginalText && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-sans shadow-2xs">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-semibold block sm:inline">
                      {result.pageNumber ? `Pàgina ${result.pageNumber} del llibre reconeguda: ` : 'Pàgina reconeguda automàticament: '}
                    </span>
                    <span className="text-stone-600">Text extret per visió multimodal i llest per escoltar</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleScanNextPage}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs"
                  title="Apunta la càmera per llegir la pàgina següent del llibre"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Pàgina següent (Pàg. {(result.pageNumber || bookPages.length) + 1})</span>
                </button>
              </div>
            )}

            {/* Audio Player Card with Catalan and Natural Original Track */}
            <AudioPlayer
              catalanAudioBase64={result.audio?.audioBase64}
              originalAudioBase64={result.originalAudio?.audioBase64}
              currentLanguageTrack={currentLanguageTrack}
              onLanguageTrackChange={handleLanguageTrackChange}
              catalanText={result.catalanTranslation}
              originalText={result.originalText || result.extractedOriginalText || inputText}
              detectedLanguage={result.detectedLanguage}
              languageCode={result.languageCode}
              voiceName={voiceName}
              pacing={pacing}
              onVoiceChange={setVoiceName}
              onPacingChange={setPacing}
              onRegenerateAudio={handleRegenerateAudio}
              isRegenerating={isRegeneratingAudio}
              isLoadingOriginalAudio={isLoadingOriginalAudio}
              onAudioEnded={handleAudioEnded}
            />

            {/* Literary Insights & Translator Notes */}
            <TranslatorNotes
              detectedLanguage={result.detectedLanguage}
              detectedGenre={result.detectedGenre}
              literaryToneAssessment={result.literaryToneAssessment}
              literaryNotes={result.literaryNotes}
            />

            {/* Bilingual Reader with Paragraph Synchronization & Dual-Language Audio */}
            <BilingualReader
              paragraphs={result.paragraphs}
              fullTranslation={result.catalanTranslation}
              detectedLanguage={result.detectedLanguage}
              languageCode={result.languageCode}
              activeParagraphId={activeParagraphId}
              onSelectParagraph={setActiveParagraphId}
              onNarrateParagraph={handleNarrateParagraph}
              onNarrateOriginalParagraph={handleNarrateOriginalParagraph}
              isNarratingParagraphId={isNarratingParagraphId}
              isNarratingOriginalParagraphId={isNarratingOriginalParagraphId}
            />

            {/* Bottom Quick-Advance to Next Page Callout */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-600/15 via-amber-500/20 to-amber-600/15 border-2 border-amber-500/40 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center font-bold shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-sm font-bold text-stone-900 block">
                    {result.pageNumber
                      ? `Has acabat de llegir la Pàgina ${result.pageNumber}?`
                      : 'Vols continuar amb la següent pàgina o fragment?'}
                  </span>
                  <span className="text-xs text-stone-600">
                    Passa full al teu llibre i continua la narració de la pàgina següent en un sol clic.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleScanNextPage}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer active:scale-95"
              >
                <Camera className="w-4 h-4" />
                <span>Pàgina Següent (Pàg. {(result.pageNumber || bookPages.length) + 1})</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Camera Modal Scanner */}
      <CameraBookScanner
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCaptureAndTranslate={handleCaptureAndTranslate}
        isLoading={isCameraScanning}
        pageNumber={bookPages.length + 1}
      />

      {/* Literary Footer */}
      <footer className="border-t border-stone-200/80 bg-white/60 py-6 text-center text-xs text-stone-500 font-sans mt-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            VeuLiterària — Traducció literària d'alta gamma i narració d'audiollibres en català normatiu.
          </p>
          <div className="flex items-center gap-4 text-stone-400">
            <span>Institut d'Estudis Catalans</span>
            <span>·</span>
            <span>Gemini TTS & Flash</span>
            <span>·</span>
            <span>Veu Nativa Expressiva</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
