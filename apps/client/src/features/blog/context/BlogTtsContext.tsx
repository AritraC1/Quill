import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import type {
  TtsStatus,
  TtsArticle,
  LanguageOption,
  BlogTtsContextType,
} from "../types/tts.types";
import {
  cleanArticleText,
  chunkText,
  extractLanguagesFromVoices,
} from "../lib/tts";
import { BlogFloatingPlayer } from "../components/BlogFloatingPlayer";
import { BlogTtsContext } from "./ttsContextInstance";

interface BlogTtsProviderProps {
  children: ReactNode;
}

export const BlogTtsProvider = ({ children }: BlogTtsProviderProps) => {
  const [status, setStatus] = useState<TtsStatus>("idle");
  const [currentArticle, setCurrentArticle] = useState<TtsArticle | null>(null);
  const [rate, setRate] = useState<number>(1);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<LanguageOption[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);

  // Mutable refs to prevent stale closure inside SpeechSynthesis event handlers
  const chunksRef = useRef<string[]>([]);
  const currentChunkIndexRef = useRef<number>(0);
  const rateRef = useRef<number>(1);
  const selectedVoiceURIRef = useRef<string>("");
  const selectedLanguageRef = useRef<string>("en");
  const availableVoicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const statusRef = useRef<TtsStatus>("idle");
  const speakChunkRef = useRef<(index: number) => void>(() => {});
  const totalChunksRef = useRef<number>(0);

  // Keep refs in sync with state outside render
  useEffect(() => {
    rateRef.current = rate;
  }, [rate]);

  useEffect(() => {
    selectedVoiceURIRef.current = selectedVoiceURI;
  }, [selectedVoiceURI]);

  useEffect(() => {
    selectedLanguageRef.current = selectedLanguage;
  }, [selectedLanguage]);

  useEffect(() => {
    availableVoicesRef.current = availableVoices;
  }, [availableVoices]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    currentChunkIndexRef.current = currentChunkIndex;
  }, [currentChunkIndex]);

  useEffect(() => {
    totalChunksRef.current = totalChunks;
  }, [totalChunks]);

  // Initialize and listen to voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return;

      setAvailableVoices(voices);
      availableVoicesRef.current = voices;

      const languages = extractLanguagesFromVoices(voices);
      setAvailableLanguages(languages);

      // Determine default language and voice if not yet chosen
      setSelectedLanguage((prevLang) => {
        const langToUse =
          prevLang ||
          (languages.some((l) => l.code === "en")
            ? "en"
            : languages[0]?.code || "en");
        selectedLanguageRef.current = langToUse;

        setSelectedVoiceURI((prevURI) => {
          if (prevURI && voices.some((v) => v.voiceURI === prevURI)) {
            return prevURI;
          }
          // Find matching voice for this language
          const matching =
            voices.find(
              (v) =>
                v.lang.toLowerCase().startsWith(langToUse.toLowerCase()) &&
                v.default,
            ) ||
            voices.find((v) =>
              v.lang.toLowerCase().startsWith(langToUse.toLowerCase()),
            ) ||
            voices[0];

          const uri = matching ? matching.voiceURI : "";
          selectedVoiceURIRef.current = uri;
          return uri;
        });

        return langToUse;
      });
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Heartbeat to circumvent Chrome's long playback idle pause bug
  useEffect(() => {
    if (status !== "playing") return;

    const interval = window.setInterval(() => {
      if (
        typeof window !== "undefined" &&
        "speechSynthesis" in window &&
        window.speechSynthesis.speaking &&
        !window.speechSynthesis.paused
      ) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 12000);

    return () => window.clearInterval(interval);
  }, [status]);

  // Core chunk speech handler
  const speakChunk = useCallback((index: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const chunks = chunksRef.current;
    if (index < 0 || index >= chunks.length) {
      // Completed reading the entire article
      setStatus("idle");
      statusRef.current = "idle";
      setCurrentChunkIndex(0);
      currentChunkIndexRef.current = 0;
      return;
    }

    // Cancel current speaking utterance
    window.speechSynthesis.cancel();

    const textToSpeak = chunks[index];
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = rateRef.current;

    // Attach chosen voice
    const voices = availableVoicesRef.current;
    const voice =
      voices.find((v) => v.voiceURI === selectedVoiceURIRef.current) ||
      voices.find((v) =>
        v.lang.toLowerCase().startsWith(selectedLanguageRef.current.toLowerCase()),
      );

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.onend = () => {
      // Proceed only if still playing (not paused or stopped)
      if (statusRef.current === "playing") {
        const nextIndex = index + 1;
        setCurrentChunkIndex(nextIndex);
        currentChunkIndexRef.current = nextIndex;
        speakChunkRef.current(nextIndex);
      }
    };

    utterance.onerror = (e) => {
      // 'interrupted' or 'canceled' are standard when we cancel on speed/voice change or pause
      if (e.error === "interrupted" || e.error === "canceled") {
        return;
      }
      console.warn("TTS SpeechSynthesisUtterance error:", e);
      if (statusRef.current === "playing") {
        const nextIndex = index + 1;
        setCurrentChunkIndex(nextIndex);
        currentChunkIndexRef.current = nextIndex;
        speakChunkRef.current(nextIndex);
      }
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  useEffect(() => {
    speakChunkRef.current = speakChunk;
  }, [speakChunk]);

  // 1. Play article
  const play = useCallback(
    (article: TtsArticle) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }

      window.speechSynthesis.cancel();

      const fullCleanText = cleanArticleText(article.title, article.content);
      const chunks = chunkText(fullCleanText);

      chunksRef.current = chunks;
      setTotalChunks(chunks.length);
      setCurrentArticle(article);

      currentChunkIndexRef.current = 0;
      setCurrentChunkIndex(0);

      statusRef.current = "playing";
      setStatus("playing");

      speakChunk(0);
    },
    [speakChunk],
  );

  // 2. Pause
  const pause = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    statusRef.current = "paused";
    setStatus("paused");
    window.speechSynthesis.pause();
  }, []);

  // 2. Resume
  const resume = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    statusRef.current = "playing";
    setStatus("playing");

    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // Safety fallback: if speech synthesis didn't wake up within 120ms, re-speak current chunk
    window.setTimeout(() => {
      if (statusRef.current === "playing" && !window.speechSynthesis.speaking) {
        speakChunk(currentChunkIndexRef.current);
      }
    }, 120);
  }, [speakChunk]);

  // 3. Stop
  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    statusRef.current = "idle";
    setStatus("idle");
    window.speechSynthesis.cancel();
    setCurrentArticle(null);
    setCurrentChunkIndex(0);
    currentChunkIndexRef.current = 0;
    chunksRef.current = [];
    totalChunksRef.current = 0;
    setTotalChunks(0);
  }, []);

  // Seek directly to a chunk index (support navigating to and fro)
  const seek = useCallback((targetIndex: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const total = totalChunksRef.current;
    if (total === 0) return;

    const bounded = Math.max(0, Math.min(total - 1, targetIndex));
    currentChunkIndexRef.current = bounded;
    setCurrentChunkIndex(bounded);

    if (statusRef.current === "playing") {
      speakChunkRef.current(bounded);
    }
  }, []);

  // Seek by percentage (0 - 100)
  const seekToPercent = useCallback(
    (percent: number) => {
      const total = totalChunksRef.current;
      if (total === 0) return;
      const normalized = Math.max(0, Math.min(100, percent));
      const targetIndex = Math.min(
        total - 1,
        Math.floor((normalized / 100) * total),
      );
      seek(targetIndex);
    },
    [seek],
  );

  // 4. Change speed while speaking
  const setSpeed = useCallback(
    (newRate: number) => {
      setRate(newRate);
      rateRef.current = newRate;

      // If active, restart current chunk immediately with new speed
      if (statusRef.current === "playing") {
        speakChunk(currentChunkIndexRef.current);
      }
    },
    [speakChunk],
  );

  // 5. Change voice while speaking
  const setVoice = useCallback(
    (newVoiceURI: string) => {
      setSelectedVoiceURI(newVoiceURI);
      selectedVoiceURIRef.current = newVoiceURI;

      // Also align language if the voice is in another language
      const voice = availableVoicesRef.current.find((v) => v.voiceURI === newVoiceURI);
      if (voice && voice.lang) {
        const langCode = voice.lang.split("-")[0]?.toLowerCase() || voice.lang;
        setSelectedLanguage(langCode);
        selectedLanguageRef.current = langCode;
      }

      // If active, restart current chunk immediately with new voice
      if (statusRef.current === "playing") {
        speakChunk(currentChunkIndexRef.current);
      }
    },
    [speakChunk],
  );

  // 7. Language selection
  const setLanguage = useCallback(
    (langCode: string) => {
      setSelectedLanguage(langCode);
      selectedLanguageRef.current = langCode;

      // Automatically select the best voice matching this language
      const voices = availableVoicesRef.current;
      const matchedVoice =
        voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith(langCode.toLowerCase()) && v.default,
        ) ||
        voices.find((v) =>
          v.lang.toLowerCase().startsWith(langCode.toLowerCase()),
        );

      if (matchedVoice) {
        setSelectedVoiceURI(matchedVoice.voiceURI);
        selectedVoiceURIRef.current = matchedVoice.voiceURI;
      }

      // If active, restart current chunk immediately in the new language/voice
      if (statusRef.current === "playing") {
        speakChunk(currentChunkIndexRef.current);
      }
    },
    [speakChunk],
  );

  const value: BlogTtsContextType = {
    status,
    currentArticle,
    rate,
    selectedVoiceURI,
    selectedLanguage,
    availableVoices,
    availableLanguages,
    currentChunkIndex,
    totalChunks,
    play,
    pause,
    resume,
    stop,
    seek,
    seekToPercent,
    setSpeed,
    setVoice,
    setLanguage,
  };

  return (
    <BlogTtsContext.Provider value={value}>
      {children}
      <BlogFloatingPlayer />
    </BlogTtsContext.Provider>
  );
};
