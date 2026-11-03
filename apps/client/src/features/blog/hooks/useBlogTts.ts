import { useContext } from "react";
import { BlogTtsContext } from "../context/ttsContextInstance";
import type { BlogTtsContextType } from "../types/tts.types";

export const useBlogTts = (): BlogTtsContextType => {
  const ctx = useContext(BlogTtsContext);
  if (!ctx) {
    throw new Error("useBlogTts must be used within a BlogTtsProvider");
  }
  return ctx;
};
