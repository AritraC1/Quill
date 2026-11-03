import { createContext } from "react";
import type { BlogTtsContextType } from "../types/tts.types";

export const BlogTtsContext = createContext<BlogTtsContextType | null>(null);

