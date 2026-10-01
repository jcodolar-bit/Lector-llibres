export interface ParagraphPair {
  id: number;
  original: string;
  translation: string;
}

export interface TranslationResult {
  extractedOriginalText?: string;
  originalText?: string;
  detectedLanguage: string;
  languageCode?: string;
  detectedGenre?: string;
  literaryToneAssessment?: string;
  catalanTranslation: string;
  paragraphs: ParagraphPair[];
  literaryNotes?: string;
  audio?: {
    audioBase64: string;
    mimeType: string;
    voice: string;
  } | null;
  originalAudio?: {
    audioBase64: string;
    mimeType: string;
    voice: string;
  } | null;
  timestamp?: number;
  pageNumber?: number;
  thumbnailUrl?: string;
}

export interface ScannedBookPage extends TranslationResult {
  pageNumber: number;
  thumbnailUrl?: string;
}

export type AudioLanguageTrack = 'catalan' | 'original';

export type LiteraryTone = 'classic' | 'contemporary' | 'poetic' | 'theatrical';

export type NarratorVoice = 'Kore' | 'Fenrir' | 'Puck' | 'Zephyr' | 'Charon';

export type NarratorPacing = 'contemplative' | 'natural' | 'dramatic';

export interface SampleExcerpt {
  title: string;
  author: string;
  language: string;
  languageCode: string;
  genre: string;
  suggestedTone: LiteraryTone;
  suggestedVoice: NarratorVoice;
  text: string;
}
