import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, RotateCcw, Sparkles, RefreshCw, Languages, Globe } from 'lucide-react';
import { NarratorVoice, NarratorPacing, AudioLanguageTrack } from '../types';

interface AudioPlayerProps {
  catalanAudioBase64?: string | null;
  originalAudioBase64?: string | null;
  currentLanguageTrack: AudioLanguageTrack;
  onLanguageTrackChange: (track: AudioLanguageTrack) => void;
  catalanText: string;
  originalText: string;
  detectedLanguage: string;
  languageCode?: string;
  voiceName: NarratorVoice;
  pacing: NarratorPacing;
  onVoiceChange: (voice: NarratorVoice) => void;
  onPacingChange: (pacing: NarratorPacing) => void;
  onRegenerateAudio: () => void;
  isRegenerating?: boolean;
  isLoadingOriginalAudio?: boolean;
  onAudioEnded?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  catalanAudioBase64,
  originalAudioBase64,
  currentLanguageTrack,
  onLanguageTrackChange,
  catalanText,
  originalText,
  detectedLanguage,
  languageCode = 'en',
  voiceName,
  pacing,
  onVoiceChange,
  onPacingChange,
  onRegenerateAudio,
  isRegenerating = false,
  isLoadingOriginalAudio = false,
  onAudioEnded,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [usingSpeechSynthesis, setUsingSpeechSynthesis] = useState(false);
  const [isWebSpeechSpeaking, setIsWebSpeechSpeaking] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  // Active audio base64 depending on current language track
  const activeAudioBase64 = currentLanguageTrack === 'catalan' ? catalanAudioBase64 : originalAudioBase64;
  const activeTextToSpeak = currentLanguageTrack === 'catalan' ? catalanText : originalText;
  const isOriginalTrack = currentLanguageTrack === 'original';

  // Sync audio source with Blob URL whenever active audio changes
  useEffect(() => {
    let blobUrl: string | null = null;

    if (activeAudioBase64) {
      setUsingSpeechSynthesis(false);
      try {
        const binary = atob(activeAudioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/wav' });
        blobUrl = URL.createObjectURL(blob);
      } catch (err) {
        console.warn('Failed to create Blob, fallback to data URI:', err);
        blobUrl = `data:audio/wav;base64,${activeAudioBase64}`;
      }

      if (audioRef.current) {
        audioRef.current.src = blobUrl;
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.volume = isMuted ? 0 : volume;
        audioRef.current.load();

        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
              setAutoplayBlocked(false);
            })
            .catch((err) => {
              console.info('Autoplay paused pending user tap:', err);
              setIsPlaying(false);
              setAutoplayBlocked(true);
            });
        }
      }
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setAutoplayBlocked(false);
    }

    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [activeAudioBase64, currentLanguageTrack]);

  const togglePlay = () => {
    setAutoplayBlocked(false);

    if (usingSpeechSynthesis || !activeAudioBase64) {
      toggleWebSpeech();
      return;
    }

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch((e) => {
          console.error('Audio play error:', e);
          toggleWebSpeech();
        });
    }
  };

  const toggleWebSpeech = () => {
    if (!('speechSynthesis' in window)) {
      alert('El vostre navegador no suporta la síntesi de veu.');
      return;
    }

    if (isWebSpeechSpeaking) {
      window.speechSynthesis.cancel();
      setIsWebSpeechSpeaking(false);
      setIsPlaying(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(activeTextToSpeak);
      const targetLang = isOriginalTrack ? (languageCode || 'en') : 'ca-ES';
      utterance.lang = targetLang;
      utterance.rate = playbackRate;

      const voices = window.speechSynthesis.getVoices();
      let matchedVoice = null;
      if (isOriginalTrack) {
        matchedVoice = voices.find((v) => v.lang.toLowerCase().startsWith(targetLang.slice(0, 2).toLowerCase()));
      } else {
        matchedVoice = voices.find(
          (v) =>
            v.lang.startsWith('ca') ||
            v.name.toLowerCase().includes('catalan') ||
            v.name.includes('Jordi') ||
            v.name.includes('Montserrat')
        );
      }

      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onstart = () => {
        setIsWebSpeechSpeaking(true);
        setIsPlaying(true);
        setAutoplayBlocked(false);
      };
      utterance.onend = () => {
        setIsWebSpeechSpeaking(false);
        setIsPlaying(false);
        onAudioEnded?.();
      };
      utterance.onerror = () => {
        setIsWebSpeechSpeaking(false);
        setIsPlaying(false);
      };

      window.speechSynthesis.speak(utterance);
      setUsingSpeechSynthesis(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    if (isWebSpeechSpeaking) {
      toggleWebSpeech();
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);
      audioRef.current.volume = nextMuted ? 0 : volume;
    }
  };

  const downloadAudio = () => {
    if (!activeAudioBase64) return;
    const a = document.createElement('a');
    a.href = `data:audio/wav;base64,${activeAudioBase64}`;
    a.download = `audiollibre-${currentLanguageTrack}-${voiceName.toLowerCase()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="bg-stone-900 text-stone-100 rounded-2xl p-5 md:p-6 shadow-xl border border-stone-800 transition-all duration-300">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          onAudioEnded?.();
        }}
      />

      {/* Language Track Selector Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-stone-800">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest font-semibold text-amber-400 font-sans">
                Estudi de Narració d'Audiollibres
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/60 text-amber-300 border border-amber-700/50">
                {usingSpeechSynthesis
                  ? 'Veu del Dispositiu'
                  : activeAudioBase64
                  ? 'Gemini TTS 24kHz'
                  : 'Àudio per Generar'}
              </span>
            </div>
            <p className="text-sm text-stone-300 font-sans font-medium">
              Veu: <span className="text-white font-semibold">{voiceName}</span>
              {' · '}
              <span className="text-stone-400 capitalize">
                {pacing === 'contemplative'
                  ? 'Pausat i contemplatiu'
                  : pacing === 'dramatic'
                  ? 'Dramàtic i viu'
                  : 'Fluid i natural'}
              </span>
            </p>
          </div>
        </div>

        {/* Dual Language Switcher: Catalan vs Natural Original */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-stone-950 p-1 rounded-xl border border-stone-800 shadow-inner">
            <button
              onClick={() => onLanguageTrackChange('catalan')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                currentLanguageTrack === 'catalan'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Escolta la narració en traducció catalana normativa"
            >
              <span>Català (Traducció)</span>
            </button>

            <button
              onClick={() => onLanguageTrackChange('original')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                currentLanguageTrack === 'original'
                  ? 'bg-amber-500 text-stone-950 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title={`Escolta la narració en l'idioma natural original (${detectedLanguage})`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Idioma Natural ({detectedLanguage || 'Original'})</span>
            </button>
          </div>

          {/* Regenerate Button */}
          <button
            onClick={onRegenerateAudio}
            disabled={isRegenerating || isLoadingOriginalAudio}
            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium px-3 py-2 rounded-xl disabled:opacity-50 transition-all cursor-pointer shadow-sm active:scale-95 text-xs"
            title="Regenerar l'àudio de la pista activa"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating || isLoadingOriginalAudio ? 'animate-spin' : ''}`} />
            <span>{isRegenerating || isLoadingOriginalAudio ? 'Generant...' : 'Regenerar'}</span>
          </button>
        </div>
      </div>

      {/* Voice & Pacing Configuration Subrow */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-stone-800/80 text-xs text-stone-300">
        <div className="flex items-center gap-2">
          <span className="text-stone-400">Pista actual:</span>
          <span className="font-semibold text-amber-300 flex items-center gap-1">
            {isOriginalTrack ? (
              <>
                <Globe className="w-3.5 h-3.5" />
                <span>Text Original en {detectedLanguage}</span>
              </>
            ) : (
              <>
                <span>Traducció Literària en Català</span>
              </>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={voiceName}
            onChange={(e) => onVoiceChange(e.target.value as NarratorVoice)}
            className="bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
            title="Tria la veu del narrador"
          >
            <option value="Kore">Kore (Femenina càlida)</option>
            <option value="Fenrir">Fenrir (Masculina profunda)</option>
            <option value="Puck">Puck (Expressiva i dinàmica)</option>
            <option value="Zephyr">Zephyr (Serena i reposada)</option>
            <option value="Charon">Charon (Solemne i dramàtica)</option>
          </select>

          <select
            value={pacing}
            onChange={(e) => onPacingChange(e.target.value as NarratorPacing)}
            className="bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
            title="Ritme de lectura"
          >
            <option value="natural">Ritme natural</option>
            <option value="contemplative">Ritme pausat</option>
            <option value="dramatic">Ritme dramàtic</option>
          </select>
        </div>
      </div>

      {/* Prominent Autoplay Blocked Callout */}
      {autoplayBlocked && !isPlaying && (
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/25 via-amber-600/30 to-amber-500/25 border-2 border-amber-400/80 flex flex-col sm:flex-row items-center justify-between gap-3 animate-pulse shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-400 text-stone-950 flex items-center justify-center font-bold">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-white block">
                La narració en {isOriginalTrack ? detectedLanguage : 'català'} està a punt!
              </span>
              <span className="text-xs text-amber-200 font-sans">
                Fes clic per iniciar la reproducció d'àudio en veu alta.
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current
                  .play()
                  .then(() => {
                    setIsPlaying(true);
                    setAutoplayBlocked(false);
                  })
                  .catch(() => {
                    toggleWebSpeech();
                  });
              } else {
                toggleWebSpeech();
              }
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current ml-0.5" />
            <span>Escoltar Ara</span>
          </button>
        </div>
      )}

      {/* Main playback control row */}
      <div className="mt-4 flex flex-col md:flex-row items-center gap-4">
        {/* Play/Pause & Skip */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
              }
            }}
            className="text-stone-400 hover:text-stone-200 transition p-1.5 rounded-full hover:bg-stone-800 cursor-pointer"
            title="Retrocedeix 10 segons"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            className={`w-14 h-14 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer ${
              isPlaying
                ? 'bg-amber-500 text-stone-950 shadow-amber-500/30'
                : 'bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 shadow-amber-900/40 ring-4 ring-amber-500/20'
            }`}
            title={isPlaying ? 'Pausa la lectura' : 'Reprodueix la narració en veu alta'}
          >
            {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
          </button>
        </div>

        {/* Progress Bar & Status */}
        <div className="flex-1 w-full flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-stone-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <div className="flex items-center gap-1.5">
              {isPlaying ? (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] rounded-full bg-emerald-500/20 text-emerald-300 font-sans border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  Llegint en {isOriginalTrack ? detectedLanguage : 'català'}
                </span>
              ) : (
                <span className="text-[11px] text-stone-400 font-sans">
                  {activeAudioBase64 ? 'Preparat per reproduir' : 'Àudio preparat'}
                </span>
              )}
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="relative flex items-center group">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              disabled={!activeAudioBase64}
              className="w-full h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Speed, Volume & Download */}
        <div className="flex items-center gap-3">
          {/* Playback rate buttons */}
          <div className="flex bg-stone-800/80 rounded-lg p-0.5 border border-stone-700/60 text-xs">
            {[0.8, 1.0, 1.25, 1.5].map((rate) => (
              <button
                key={rate}
                onClick={() => handleSpeedChange(rate)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                  playbackRate === rate ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-300 hover:text-white'
                }`}
              >
                {rate}x
              </button>
            ))}
          </div>

          {/* Volume */}
          <div className="flex items-center gap-1.5 text-stone-400 hover:text-stone-200">
            <button onClick={toggleMute} className="p-1 hover:bg-stone-800 rounded cursor-pointer" title="Silenciar">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-14 h-1.5 bg-stone-800 rounded appearance-none accent-amber-500 cursor-pointer"
              title="Volum"
            />
          </div>

          {/* Download button */}
          {activeAudioBase64 && (
            <button
              onClick={downloadAudio}
              className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-amber-400 transition cursor-pointer"
              title={`Descarregar audiollibre en format .WAV (${currentLanguageTrack})`}
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
