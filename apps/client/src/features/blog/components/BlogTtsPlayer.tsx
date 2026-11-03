import { useMemo, useRef } from "react";
import {
  Play,
  Pause,
  Square,
  Headphones,
  Languages,
  Mic,
  Gauge,
} from "lucide-react";
import { useBlogTts } from "../hooks/useBlogTts";
import type { BlogResponseDTO } from "@quill/shared";

interface BlogTtsPlayerProps {
  blog: Pick<BlogResponseDTO, "id" | "title" | "content">;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

export const BlogTtsPlayer = ({ blog }: BlogTtsPlayerProps) => {
  const {
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
    seekToPercent,
    setSpeed,
    setVoice,
    setLanguage,
  } = useBlogTts();

  const progressBarRef = useRef<HTMLDivElement>(null);

  const isThisArticleActive =
    currentArticle?.id === blog.id && (status === "playing" || status === "paused");
  const isPlaying = isThisArticleActive && status === "playing";

  const handleListen = () => {
    play({
      id: blog.id,
      title: blog.title || "Untitled",
      content: blog.content,
    });
  };

  // Normal player seekable progress bar: click or scrub to and fro
  const handleSeekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || totalChunks <= 0) return;
    const bar = progressBarRef.current;
    try {
      bar.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const seekWithClientX = (clientX: number) => {
      const rect = bar.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, relativeX / rect.width));
      seekToPercent(ratio * 100);
    };

    seekWithClientX(e.clientX);

    const onPointerMove = (moveEvent: PointerEvent) => {
      seekWithClientX(moveEvent.clientX);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      try {
        bar.releasePointerCapture(upEvent.pointerId);
      } catch {
        // ignore
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  // Voices filtered for selected language
  const voicesForLang = useMemo(() => {
    if (!selectedLanguage) return availableVoices;
    const filtered = availableVoices.filter((v) =>
      v.lang.toLowerCase().startsWith(selectedLanguage.toLowerCase()),
    );
    return filtered.length > 0 ? filtered : availableVoices;
  }, [availableVoices, selectedLanguage]);

  const progressPercent =
    totalChunks > 0
      ? Math.min(100, Math.max(0, Math.round(((currentChunkIndex + 1) / totalChunks) * 100)))
      : 0;

  // Unactivated state: Simple, clean "Listen to article" button with headphone icon
  if (!isThisArticleActive) {
    return (
      <div className="my-5">
        <button
          type="button"
          onClick={handleListen}
          className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-[#DCD6C8] bg-[#FBF9F4] text-[#1B1F1C] hover:bg-[#F2ECE0] hover:border-[#1F3D2F]/40 hover:text-[#1F3D2F] transition-all duration-200 shadow-2xs text-[13px] font-medium"
        >
          <Headphones className="w-4 h-4 text-[#1F3D2F] group-hover:scale-110 transition-transform" />
          <span>Listen to article</span>
        </button>
      </div>
    );
  }

  // Active playing/paused state: Inline audio player control panel
  return (
    <div className="my-6 rounded-2xl border border-[#DDD7CB] bg-[#F7F4EC] p-4 sm:p-5 shadow-xs transition-all duration-300">
      {/* Top Header: Indicator + Progress + Stop */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E7E2D6]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#1F3D2F] text-[#A8D5BA] flex items-center justify-center relative">
            <Headphones className="w-4 h-4" />
            {isPlaying && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#A8D5BA] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#A8D5BA]" />
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-[#1F3D2F] uppercase tracking-wider">
                {isPlaying ? "Playing article" : "Audio paused"}
              </span>
              <span className="text-[11px] text-[#717873] font-medium">
                · {progressPercent}% read
              </span>
            </div>
            <p className="text-[11px] text-[#8A8F8B]">
              Section {Math.min(currentChunkIndex + 1, totalChunks || 1)} of {totalChunks || 1}
            </p>
          </div>
        </div>

        {/* Stop button */}
        <button
          type="button"
          onClick={stop}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#D7D1C3] bg-white hover:bg-[#EDE8DC] text-[#4E5450] hover:text-[#1B1F1C] text-xs font-medium transition-colors"
          title="Stop audio playback"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
          <span>Stop</span>
        </button>
      </div>

      {/* Seekable Progress Bar: Contained inside box, scrub to and fro */}
      <div className="mt-3 mb-4 flex items-center gap-2.5">
        <span className="text-[11px] text-[#1F3D2F] font-mono tabular-nums select-none min-w-8">
          {progressPercent}%
        </span>
        <div
          ref={progressBarRef}
          onPointerDown={handleSeekPointerDown}
          className="relative flex-1 py-1.5 cursor-pointer group touch-none select-none"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
          aria-label="Seek article audio"
        >
          {/* Background Track */}
          <div className="w-full bg-[#E4DFC2]/70 h-1.5 rounded-full overflow-hidden group-hover:h-2 transition-all">
            {/* Filled Progress */}
            <div
              className="bg-[#1F3D2F] h-full transition-all duration-100 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {/* Scrubber Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-[#1F3D2F] rounded-full shadow-md border-2 border-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `${progressPercent}%` }}
          />
        </div>
        <span className="text-[11px] text-[#717873] font-mono tabular-nums select-none min-w-10 text-right">
          {Math.min(currentChunkIndex + 1, totalChunks || 1)}/{totalChunks || 1}
        </span>
      </div>

      {/* Controls: Play/Pause, Speed, Voice, Language */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Left: Play/Pause & Speed */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={isPlaying ? pause : resume}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1F3D2F] hover:bg-[#2B523F] text-white text-xs font-medium shadow-xs transition-transform active:scale-95"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>Resume</span>
              </>
            )}
          </button>

          {/* Speed Pills */}
          <div className="flex items-center gap-1 bg-[#ECE7DC] p-1 rounded-lg border border-[#DDD7CB]">
            <Gauge className="w-3.5 h-3.5 text-[#5C625E] ml-1 mr-0.5" />
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  rate === s
                    ? "bg-[#1F3D2F] text-white shadow-2xs"
                    : "text-[#5C625E] hover:text-[#1B1F1C] hover:bg-[#DDD7CB]"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Right: Language and Voice Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Language Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-[#DDD7CB] rounded-lg px-2 py-1 text-xs">
            <Languages className="w-3.5 h-3.5 text-[#1F3D2F]" />
            <select
              value={selectedLanguage}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-[#1B1F1C] font-medium text-xs focus:outline-hidden cursor-pointer"
              title="Select language"
            >
              {availableLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-[#DDD7CB] rounded-lg px-2 py-1 text-xs max-w-44 sm:max-w-56">
            <Mic className="w-3.5 h-3.5 text-[#1F3D2F] flex-shrink-0" />
            <select
              value={selectedVoiceURI}
              onChange={(e) => setVoice(e.target.value)}
              className="bg-transparent text-[#1B1F1C] font-medium text-xs focus:outline-hidden truncate cursor-pointer w-full"
              title="Select voice"
            >
              {voicesForLang.map((voice) => {
                const displayName =
                  voice.name.replace(/Google|Microsoft|Apple|Desktop/gi, "").trim() ||
                  voice.name;
                return (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {displayName}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
