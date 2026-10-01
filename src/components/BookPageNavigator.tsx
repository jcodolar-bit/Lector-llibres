import React from 'react';
import { ChevronLeft, ChevronRight, Camera, BookOpen, Sparkles, Check, Plus, Trash2 } from 'lucide-react';
import { ScannedBookPage } from '../types';

interface BookPageNavigatorProps {
  pages: ScannedBookPage[];
  currentPageIndex: number;
  onSelectPage: (index: number) => void;
  onScanNextPage: () => void;
  autoOpenOnAudioEnd: boolean;
  onToggleAutoOpenOnAudioEnd: (enabled: boolean) => void;
  onClearSession?: () => void;
}

export const BookPageNavigator: React.FC<BookPageNavigatorProps> = ({
  pages,
  currentPageIndex,
  onSelectPage,
  onScanNextPage,
  autoOpenOnAudioEnd,
  onToggleAutoOpenOnAudioEnd,
  onClearSession,
}) => {
  if (pages.length === 0) return null;

  const currentPage = pages[currentPageIndex];
  const hasPrevious = currentPageIndex > 0;
  const hasNextExisting = currentPageIndex < pages.length - 1;
  const isLatestPage = currentPageIndex === pages.length - 1;
  const nextPageNumber = pages.length + 1;

  return (
    <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 border border-stone-800 rounded-2xl p-4 md:p-5 shadow-xl text-stone-150 transition-all">
      {/* Top row: Page navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Previous page button and reset button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => hasPrevious && onSelectPage(currentPageIndex - 1)}
            disabled={!hasPrevious}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              hasPrevious
                ? 'bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white shadow-xs'
                : 'bg-stone-900/60 text-stone-600 cursor-not-allowed border border-stone-800/60'
            }`}
            title="Tornar a la pàgina anterior"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Pàgina anterior</span>
          </button>

          {onClearSession && (
            <button
              onClick={onClearSession}
              className="p-2 rounded-xl bg-stone-800 hover:bg-red-950/70 text-stone-400 hover:text-red-400 border border-stone-700/60 transition cursor-pointer"
              title="Començar una nova lectura i buidar les pàgines d'aquesta sessió"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Center: Current Page Badge & Pages pills */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-950/80 border border-stone-800">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-white">
              Pàgina {currentPage?.pageNumber || currentPageIndex + 1}
            </span>
            <span className="text-xs text-stone-500">de {pages.length}</span>
          </div>

          {/* Quick Page Picker Dots/Numbers for multi-page reading */}
          {pages.length > 1 && (
            <div className="hidden sm:flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800">
              {pages.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => onSelectPage(idx)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center ${
                    idx === currentPageIndex
                      ? 'bg-amber-500 text-stone-950 shadow-sm'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                  }`}
                  title={`Anar a la pàgina ${p.pageNumber}`}
                >
                  {p.pageNumber}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Next page action */}
        {hasNextExisting ? (
          <button
            onClick={() => onSelectPage(currentPageIndex + 1)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold transition cursor-pointer shadow-md active:scale-95"
            title="Avançar a la pàgina següent ja escanejada"
          >
            <span>Pàgina següent</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onScanNextPage}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-stone-950 text-xs sm:text-sm font-bold shadow-lg shadow-amber-900/30 hover:scale-105 active:scale-95 transition-all cursor-pointer ring-2 ring-amber-400/40 animate-pulse"
            title={`Passa full al llibre i escaneja la pàgina ${nextPageNumber}`}
          >
            <Camera className="w-4 h-4" />
            <span>Pàgina següent (Pàg. {nextPageNumber})</span>
            <Plus className="w-3.5 h-3.5 font-bold" />
          </button>
        )}
      </div>

      {/* Dynamic Action Callout for next page reading */}
      {isLatestPage && (
        <div className="mt-4 pt-3.5 border-t border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-stone-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>
              Llegint el teu llibre en continu: pots passar full físicament i clicar a{' '}
              <strong className="text-amber-300">Pàgina següent</strong>.
            </span>
          </div>

          <label className="flex items-center gap-2 text-stone-300 hover:text-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoOpenOnAudioEnd}
              onChange={(e) => onToggleAutoOpenOnAudioEnd(e.target.checked)}
              className="rounded accent-amber-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-[11px] text-stone-400">
              Obrir càmera sola en acabar d'escoltar la pàgina
            </span>
          </label>
        </div>
      )}
    </div>
  );
};
