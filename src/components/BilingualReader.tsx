import React, { useState } from 'react';
import { Copy, Check, Volume2, Columns, BookOpen, Sparkles, Globe } from 'lucide-react';
import { ParagraphPair } from '../types';

interface BilingualReaderProps {
  paragraphs: ParagraphPair[];
  fullTranslation: string;
  detectedLanguage?: string;
  languageCode?: string;
  activeParagraphId: number | null;
  onSelectParagraph: (id: number) => void;
  onNarrateParagraph: (text: string, id: number) => void;
  onNarrateOriginalParagraph?: (text: string, id: number) => void;
  isNarratingParagraphId: number | null;
  isNarratingOriginalParagraphId?: number | null;
}

export const BilingualReader: React.FC<BilingualReaderProps> = ({
  paragraphs,
  fullTranslation,
  detectedLanguage,
  languageCode,
  activeParagraphId,
  onSelectParagraph,
  onNarrateParagraph,
  onNarrateOriginalParagraph,
  isNarratingParagraphId,
  isNarratingOriginalParagraphId,
}) => {
  const [viewMode, setViewMode] = useState<'bilingual' | 'catalan_only'>('bilingual');
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullTranslation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fontSizeClass = {
    normal: 'text-base leading-relaxed',
    large: 'text-lg leading-loose',
    xlarge: 'text-xl leading-loose',
  }[fontSize];

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden transition-all">
      {/* Reader Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-stone-100/70 border-b border-stone-200 text-stone-700">
        <div className="flex items-center gap-2">
          <div className="flex bg-stone-200/80 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setViewMode('bilingual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'bilingual'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Bilingüe comparat</span>
            </button>
            <button
              onClick={() => setViewMode('catalan_only')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
                viewMode === 'catalan_only'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Només Català</span>
            </button>
          </div>

          <span className="hidden sm:inline-block text-xs text-stone-400">|</span>

          {/* Font size picker */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-stone-500 font-sans text-xs mr-1">Mida:</span>
            {(['normal', 'large', 'xlarge'] as const).map((size) => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`px-2 py-0.5 rounded border text-xs cursor-pointer ${
                  fontSize === size
                    ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold'
                    : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                }`}
              >
                {size === 'normal' ? 'A' : size === 'large' ? 'A+' : 'A++'}
              </button>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-lg shadow-2xs transition cursor-pointer"
            title="Copia el text traduït al porta-retalls"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiat!' : 'Copiar traducció'}</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="p-6 md:p-8 space-y-6">
        {paragraphs.length === 0 ? (
          <div className="font-serif whitespace-pre-line text-stone-800 leading-relaxed font-normal">
            {fullTranslation}
          </div>
        ) : (
          <div className="space-y-4">
            {paragraphs.map((p) => {
              const isActive = activeParagraphId === p.id;
              const isSpeakingThis = isNarratingParagraphId === p.id;
              const isSpeakingOriginalThis = isNarratingOriginalParagraphId === p.id;

              return (
                <div
                  key={p.id}
                  onClick={() => onSelectParagraph(p.id)}
                  className={`group relative rounded-xl p-4 transition-all duration-200 cursor-pointer ${
                    isSpeakingThis
                      ? 'bg-amber-100/90 ring-2 ring-amber-500 shadow-md scale-[1.005]'
                      : isSpeakingOriginalThis
                      ? 'bg-blue-50/90 ring-2 ring-blue-400 shadow-md scale-[1.005]'
                      : isActive
                      ? 'bg-amber-100/40 ring-1 ring-amber-300/80 shadow-2xs'
                      : 'hover:bg-amber-50/40 hover:ring-1 hover:ring-amber-200/50'
                  }`}
                >
                  {viewMode === 'bilingual' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 items-start">
                      {/* Original Excerpt with its own Natural Voice button */}
                      <div className="text-stone-500 font-serif border-l-2 border-stone-200 pl-3 md:pl-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] tracking-widest uppercase font-sans text-stone-400 flex items-center gap-1 font-semibold">
                            <Globe className="w-3 h-3 text-stone-500" />
                            {detectedLanguage ? `Original (${detectedLanguage})` : 'Original'}
                          </span>

                          {onNarrateOriginalParagraph && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onNarrateOriginalParagraph(p.original, p.id);
                              }}
                              className={`opacity-80 group-hover:opacity-100 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition cursor-pointer ${
                                isSpeakingOriginalThis
                                  ? 'bg-blue-600 text-white animate-pulse'
                                  : 'bg-stone-100 hover:bg-blue-100 text-stone-600 hover:text-blue-900 border border-stone-200'
                              }`}
                              title={`Llegir aquest paràgraf en l'idioma natural (${detectedLanguage || 'Original'})`}
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>{isSpeakingOriginalThis ? 'Llegint original...' : `Veu ${detectedLanguage || 'Original'}`}</span>
                            </button>
                          )}
                        </div>
                        <p className={`${fontSizeClass} italic whitespace-pre-line text-stone-700`}>
                          {p.original}
                        </p>
                      </div>

                      {/* Catalan Translation */}
                      <div className="relative pl-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] tracking-widest uppercase font-sans text-amber-700 font-bold flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            Català Normatiu
                          </span>

                          {/* Quick Narrate Paragraph Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onNarrateParagraph(p.translation, p.id);
                            }}
                            className={`opacity-80 group-hover:opacity-100 flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition cursor-pointer ${
                              isSpeakingThis
                                ? 'bg-amber-600 text-white animate-pulse'
                                : 'bg-stone-200 hover:bg-amber-200 text-stone-700 hover:text-amber-950'
                            }`}
                            title="Llegir en veu alta aquest paràgraf en català"
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>{isSpeakingThis ? 'Llegint català...' : 'Veu Català'}</span>
                          </button>
                        </div>

                        <p className={`${fontSizeClass} font-serif text-stone-900 whitespace-pre-line font-medium`}>
                          {p.translation}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* Catalan Only View */
                    <div className="relative pl-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-sans text-amber-800/80 font-medium">§ {p.id}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNarrateParagraph(p.translation, p.id);
                          }}
                          className={`opacity-80 group-hover:opacity-100 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition cursor-pointer ${
                            isSpeakingThis
                              ? 'bg-amber-600 text-white animate-pulse'
                              : 'bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 border border-stone-200'
                          }`}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{isSpeakingThis ? 'Narració activa...' : 'Llegir paràgraf'}</span>
                        </button>
                      </div>
                      <p className={`${fontSizeClass} font-serif text-stone-900 whitespace-pre-line`}>
                        {p.translation}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer advice */}
      <div className="px-6 py-3 bg-stone-50 border-t border-stone-200/80 text-xs text-stone-500 font-sans flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>Fes clic sobre qualsevol botó d'altaveu per escoltar la lectura en català o en l'idioma natural.</span>
        <span className="italic text-stone-400">Lectura directa en ambdós idiomes.</span>
      </div>
    </div>
  );
};
