import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Feather, Globe, Compass, BookOpenCheck } from 'lucide-react';

interface TranslatorNotesProps {
  detectedLanguage: string;
  detectedGenre?: string;
  literaryToneAssessment?: string;
  literaryNotes?: string;
}

export const TranslatorNotes: React.FC<TranslatorNotesProps> = ({
  detectedLanguage,
  detectedGenre,
  literaryToneAssessment,
  literaryNotes,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-4 md:p-5 text-stone-800 transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 text-left cursor-pointer group"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-100/80 text-amber-900 border border-amber-300/60 group-hover:scale-105 transition-transform">
            <Feather className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-stone-900 font-sans">
                Anotacions Literàries & Criteri de Traducció
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-950 font-medium font-sans">
                {detectedLanguage}
              </span>
              {detectedGenre && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-200/80 text-stone-700 font-sans">
                  {detectedGenre}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 font-sans line-clamp-1 mt-0.5">
              {literaryToneAssessment || 'Anàlisi d’estil, maquetació de diàlegs i decisions lèxiques.'}
            </p>
          </div>
        </div>

        <div className="text-stone-400 group-hover:text-stone-700 transition">
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-amber-200/70 space-y-3.5 text-xs text-stone-700 font-sans">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white/80 p-3 rounded-xl border border-amber-100 shadow-2xs">
              <div className="flex items-center gap-1.5 text-amber-900 font-semibold mb-1">
                <Globe className="w-3.5 h-3.5" />
                <span>Idioma & Gènere</span>
              </div>
              <p className="text-stone-600">
                Identificat com a <strong className="text-stone-900">{detectedLanguage}</strong>.
                {detectedGenre && ` Format d'obra: ${detectedGenre}.`}
              </p>
            </div>

            <div className="bg-white/80 p-3 rounded-xl border border-amber-100 shadow-2xs">
              <div className="flex items-center gap-1.5 text-amber-900 font-semibold mb-1">
                <Compass className="w-3.5 h-3.5" />
                <span>To & Expressivitat</span>
              </div>
              <p className="text-stone-600">
                {literaryToneAssessment || 'Cadència literària calculada per a narració sonora fluida.'}
              </p>
            </div>

            <div className="bg-white/80 p-3 rounded-xl border border-amber-100 shadow-2xs">
              <div className="flex items-center gap-1.5 text-amber-900 font-semibold mb-1">
                <BookOpenCheck className="w-3.5 h-3.5" />
                <span>Normativa & Diàlegs</span>
              </div>
              <p className="text-stone-600">
                Català normatiu (IEC), guions llargs («—») en diàlegs i estructuració de paràgrafs respectada.
              </p>
            </div>
          </div>

          {literaryNotes && (
            <div className="bg-white/90 p-4 rounded-xl border border-amber-200/80 mt-2">
              <h4 className="font-semibold text-stone-900 mb-1 flex items-center gap-1.5">
                <span>Comentari del Traductor Literari:</span>
              </h4>
              <p className="text-stone-700 leading-relaxed font-serif text-[13px] whitespace-pre-line">
                {literaryNotes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
