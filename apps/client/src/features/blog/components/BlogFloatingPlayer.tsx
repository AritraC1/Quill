import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Square,
  Headphones,
  Languages,
  Mic,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useBlogTts } from "../hooks/useBlogTts";

const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

export const BlogFloatingPlayer = () => {
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
    pause,
    resume,
    stop,
    seekToPercent,
    setSpeed,
    setVoice,
    setLanguage,
  } = useBlogTts();

  const [expanded, setExpanded] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const speedMenuRef = useRef<HTMLDivElement>(null);
  const voiceMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (speedMenuRef.current && !speedMenuRef.current.contains(target)) {
        setSpeedMenuOpen(false);
      }
      if (voiceMenuRef.current && !voiceMenuRef.current.contains(target)) {
        setVoiceMenuOpen(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(target)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status === "idle" || !currentArticle) {
    return null;
  }

  const isPlaying = status === "playing";
  const progressPercent =
    totalChunks > 0
      ? Math.min(100, Math.max(0, Math.round(((currentChunkIndex + 1) / totalChunks) * 100)))
      : 0;

  // Filter voices for currently selected language
  const voicesForLang = availableVoices.filter((v) =>
    selectedLanguage ? v.lang.toLowerCase().startsWith(selectedLanguage.toLowerCase()) : true,
  );
  const activeVoicesList = voicesForLang.length > 0 ? voicesForLang : availableVoices;

  const currentVoiceObj = availableVoices.find((v) => v.voiceURI === selectedVoiceURI);
  const currentVoiceName = currentVoiceObj
    ? currentVoiceObj.name.replace(/Google|Microsoft|Apple|Desktop/gi, "").trim() ||
      currentVoiceObj.name
    : "Default Voice";

  const currentLangObj = availableLanguages.find((l) => l.code === selectedLanguage);
  const currentLangLabel = currentLangObj ? currentLangObj.label : "Language";

  const handleNavigateToArticle = () => {
    const targetUrl = `/blog/${currentArticle.id}`;
    if (window.location.pathname !== targetUrl) {
      window.location.href = targetUrl;
    }
  };

  // Normal player seeking behavior: click or drag to and fro along the track
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

  return (
    <aside
      aria-label="Audio article player"
      className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-2xl bg-[#1B211D]/95 text-[#F6F3EC] backdrop-blur-md rounded-2xl border border-[#344037] shadow-2xl transition-all duration-300 p-3.5 sm:p-4"
    >
      {/* Main Top Row: Article Info & Quick Controls */}
      <div className="flex items-center justify-between gap-2.5">
        {/* Article Info & Sound Indicator */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleNavigateToArticle}
            title="Go to article"
            className="group flex items-center gap-2.5 min-w-0 text-left hover:opacity-90 transition-opacity"
          >
            <div className="relative flex-shrink-0 w-8 h-8 rounded-full bg-[#2A372E] flex items-center justify-center text-[#A8D5BA]">
              <Headphones className="w-4 h-4" />
              {isPlaying && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#A8D5BA] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#A8D5BA]" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-[#A8D5BA] font-semibold flex items-center gap-1.5">
                <span>Listening</span>
                <span>·</span>
                <span>{progressPercent}%</span>
              </p>
              <p className="text-[13px] font-medium text-white truncate group-hover:underline">
                {currentArticle.title || "Untitled Article"}
              </p>
            </div>
          </button>
        </div>

        {/* Quick Controls: Speed, Play/Pause, Stop, Expand Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Speed Badge/Button */}
          <div className="relative" ref={speedMenuRef}>
            <button
              type="button"
              onClick={() => setSpeedMenuOpen(!speedMenuOpen)}
              className="px-2 py-1 rounded-lg bg-[#28342B] hover:bg-[#344438] text-[12px] font-medium text-[#E6E2D8] border border-[#3E4E42] transition-colors"
              title="Change speed"
            >
              {rate}x
            </button>
            {speedMenuOpen && (
              <div className="absolute bottom-full mb-2 right-0 bg-[#202922] border border-[#3E4E42] rounded-xl shadow-xl py-1 z-60 min-w-24">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSpeed(s);
                      setSpeedMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between ${
                      rate === s
                        ? "bg-[#2D3C30] text-[#A8D5BA] font-semibold"
                        : "text-[#E6E2D8] hover:bg-[#28342B]"
                    }`}
                  >
                    <span>{s}x</span>
                    {rate === s && <span className="text-[10px]">●</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={isPlaying ? pause : resume}
            title={isPlaying ? "Pause article" : "Resume playback"}
            className="w-8 h-8 rounded-full bg-[#A8D5BA] hover:bg-[#96C7A8] text-[#1B211D] flex items-center justify-center transition-transform active:scale-95 shadow-sm"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          {/* Stop Button */}
          <button
            type="button"
            onClick={stop}
            title="Stop playback"
            className="w-8 h-8 rounded-full bg-[#28342B] hover:bg-[#344438] text-[#E6E2D8] hover:text-white flex items-center justify-center transition-colors border border-[#3E4E42]"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>

          {/* Expand / Settings Drawer Toggle */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Hide voice settings" : "Voice & language settings"}
            className={`p-1.5 rounded-lg border transition-colors ${
              expanded
                ? "bg-[#2D3C30] text-[#A8D5BA] border-[#3E4E42]"
                : "bg-[#28342B] text-[#8A8F8B] hover:text-[#E6E2D8] border-transparent"
            }`}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Seekable Progress Bar - Completely inside the card box, seekable to and fro */}
      <div className="mt-3 flex items-center gap-2.5">
        <span className="text-[11px] text-[#A8D5BA] font-mono tabular-nums select-none min-w-8">
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
          aria-label="Audio progress slider"
        >
          {/* Background Track */}
          <div className="w-full h-1.5 bg-[#2E3B31] rounded-full overflow-hidden group-hover:h-2 transition-all">
            {/* Filled Progress */}
            <div
              className="h-full bg-[#A8D5BA] rounded-full transition-all duration-100 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber thumb - visible on hover or dragging */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md border-2 border-[#1B211D] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        <span className="text-[11px] text-[#8A8F8B] font-mono tabular-nums select-none min-w-10 text-right">
          {Math.min(currentChunkIndex + 1, totalChunks || 1)}/{totalChunks || 1}
        </span>
      </div>

      {/* Expanded Voice & Language Tray */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-[#2D372E] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs animate-in fade-in duration-200">
          {/* Language Selector */}
          <div className="relative" ref={langMenuRef}>
            <label className="text-[10px] uppercase tracking-wider text-[#8A8F8B] mb-1 flex items-center gap-1 font-semibold">
              <Languages className="w-3 h-3 text-[#A8D5BA]" />
              Language
            </label>
            <button
              type="button"
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#252E27] border border-[#38463B] text-left text-white hover:bg-[#2C382E] transition-colors"
            >
              <span className="truncate">{currentLangLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#8A8F8B] flex-shrink-0" />
            </button>
            {langMenuOpen && (
              <div className="absolute bottom-full mb-1.5 left-0 w-full max-h-48 overflow-y-auto bg-[#202922] border border-[#3E4E42] rounded-xl shadow-xl py-1 z-60">
                {availableLanguages.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      setLanguage(l.code);
                      setLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 transition-colors flex items-center justify-between ${
                      selectedLanguage === l.code
                        ? "bg-[#2D3C30] text-[#A8D5BA] font-medium"
                        : "text-[#E6E2D8] hover:bg-[#28342B]"
                    }`}
                  >
                    <span className="truncate">{l.label}</span>
                    {selectedLanguage === l.code && <span className="text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Voice Selector */}
          <div className="relative" ref={voiceMenuRef}>
            <label className="text-[10px] uppercase tracking-wider text-[#8A8F8B] mb-1 flex items-center gap-1 font-semibold">
              <Mic className="w-3 h-3 text-[#A8D5BA]" />
              Voice
            </label>
            <button
              type="button"
              onClick={() => setVoiceMenuOpen(!voiceMenuOpen)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#252E27] border border-[#38463B] text-left text-white hover:bg-[#2C382E] transition-colors"
            >
              <span className="truncate">{currentVoiceName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#8A8F8B] flex-shrink-0" />
            </button>
            {voiceMenuOpen && (
              <div className="absolute bottom-full mb-1.5 left-0 w-full max-h-48 overflow-y-auto bg-[#202922] border border-[#3E4E42] rounded-xl shadow-xl py-1 z-60">
                {activeVoicesList.map((v) => {
                  const isSelected = v.voiceURI === selectedVoiceURI;
                  const cleanName = v.name
                    .replace(/Google|Microsoft|Apple|Desktop/gi, "")
                    .trim();
                  return (
                    <button
                      key={v.voiceURI}
                      type="button"
                      onClick={() => {
                        setVoice(v.voiceURI);
                        setVoiceMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 transition-colors flex items-center justify-between ${
                        isSelected
                          ? "bg-[#2D3C30] text-[#A8D5BA] font-medium"
                          : "text-[#E6E2D8] hover:bg-[#28342B]"
                      }`}
                    >
                      <span className="truncate">{cleanName || v.name}</span>
                      {isSelected && <span className="text-[10px]">✓</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
