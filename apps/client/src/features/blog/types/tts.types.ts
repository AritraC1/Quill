export type TtsStatus = "idle" | "playing" | "paused" | "stopped";

export interface TtsArticle {
  id: string;
  title: string;
  content: string;
}

export interface LanguageOption {
  code: string;
  label: string;
}

export interface BlogTtsContextType {
  status: TtsStatus;
  currentArticle: TtsArticle | null;
  rate: number;
  selectedVoiceURI: string;
  selectedLanguage: string;
  availableVoices: SpeechSynthesisVoice[];
  availableLanguages: LanguageOption[];
  currentChunkIndex: number;
  totalChunks: number;
  play: (article: TtsArticle) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (chunkIndex: number) => void;
  seekToPercent: (percent: number) => void;
  setSpeed: (speed: number) => void;
  setVoice: (voiceURI: string) => void;
  setLanguage: (langCode: string) => void;
}

