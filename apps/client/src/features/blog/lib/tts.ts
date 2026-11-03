import { markdownToPlainText } from "./markdown";
import type { LanguageOption } from "../types/tts.types";

/**
 * Prepares readable article text from title and markdown content.
 */
export function cleanArticleText(title: string, markdownContent: string): string {
  const plain = markdownToPlainText(markdownContent);
  const cleanTitle = (title || "").trim();
  if (!cleanTitle) return plain;
  // Ensure the title ends with a period so browser TTS pauses naturally before the body
  const titleWithPeriod = /[.!?]$/.test(cleanTitle) ? cleanTitle : `${cleanTitle}.`;
  return `${titleWithPeriod} ${plain}`.trim();
}

/**
 * Breaks long text into smaller conversational chunks (~100-180 chars).
 * This prevents the browser SpeechSynthesis bug where audio freezes after ~15 seconds,
 * and allows real-time dynamic switching of speed and voice mid-article.
 */
export function chunkText(text: string, maxChunkLength = 160): string[] {
  if (!text) return [];

  // Split into paragraphs first
  const rawParagraphs = text.split(/\n+/);
  const chunks: string[] = [];

  for (const para of rawParagraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    // Split paragraph into sentences by punctuation
    const sentences = trimmedPara.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [trimmedPara];

    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;

      if (sentence.length <= maxChunkLength) {
        chunks.push(sentence);
      } else {
        // Sentence is too long, split by comma, semicolon or space
        const clauses = sentence.split(/([,;:]\s+)/);
        let current = "";

        for (const part of clauses) {
          if ((current + part).length <= maxChunkLength) {
            current += part;
          } else {
            if (current.trim()) chunks.push(current.trim());
            // If even a single clause part is longer than maxChunkLength, split by words
            if (part.length > maxChunkLength) {
              const words = part.split(/\s+/);
              let wordBuf = "";
              for (const w of words) {
                if ((wordBuf + " " + w).length <= maxChunkLength) {
                  wordBuf = wordBuf ? `${wordBuf} ${w}` : w;
                } else {
                  if (wordBuf) chunks.push(wordBuf);
                  wordBuf = w;
                }
              }
              if (wordBuf) current = wordBuf;
              else current = "";
            } else {
              current = part;
            }
          }
        }
        if (current.trim()) {
          chunks.push(current.trim());
        }
      }
    }
  }

  return chunks;
}

const COMMON_LANGUAGES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  hi: "Hindi",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  ar: "Arabic",
  ru: "Russian",
  nl: "Dutch",
  pl: "Polish",
  tr: "Turkish",
  sv: "Swedish",
};

/**
 * Gets a human-readable display label for a language code (e.g. "en-US" -> "English (US)").
 */
export function getLanguageDisplayName(langCode: string): string {
  const normalized = (langCode || "").replace(/_/g, "-");
  const primary = normalized.split("-")[0]?.toLowerCase() || "";
  const region = normalized.split("-")[1]?.toUpperCase();

  let name: string;
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    name = displayNames.of(primary) || COMMON_LANGUAGES[primary] || primary;
  } catch {
    name = COMMON_LANGUAGES[primary] || primary;
  }

  if (!name) {
    name = COMMON_LANGUAGES[primary] || primary.toUpperCase();
  }

  if (region) {
    return `${name} (${region})`;
  }
  return name;
}

/**
 * Extracts unique languages from the available voices list.
 */
export function extractLanguagesFromVoices(voices: SpeechSynthesisVoice[]): LanguageOption[] {
  const langMap = new Map<string, string>();

  for (const voice of voices) {
    const lang = voice.lang;
    if (!lang) continue;
    // Group by primary language (or primary-region if preferred)
    const primary = lang.split("-")[0]?.toLowerCase() || lang.toLowerCase();
    if (!langMap.has(primary)) {
      langMap.set(primary, getLanguageDisplayName(primary));
    }
  }

  const result: LanguageOption[] = Array.from(langMap.entries()).map(([code, label]) => ({
    code,
    label,
  }));

  // Sort so English is on top, then alphabetical
  result.sort((a, b) => {
    if (a.code === "en") return -1;
    if (b.code === "en") return 1;
    return a.label.localeCompare(b.label);
  });

  return result;
}
