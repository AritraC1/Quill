import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Eye, FileText, Loader2, Type, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "../../../components/layout/AppShell";
import {
  createBlogApi,
  getBlogApi,
  publishBlogApi,
  updateBlogApi,
} from "../api/blog.api";
import type { BlogResponseDTO } from "@quill/shared";
import MarkdownEditor from "../components/MarkdownEditor";
import RichTextEditor from "../components/RichTextEditor";
import {
  htmlToMarkdown,
  markdownToHtml,
  markdownToPlainText,
  wordCount,
} from "../lib/markdown";

type EditorMode = "markdown" | "rich" | "preview";

const MODES: { id: EditorMode; label: string; Icon: typeof Type }[] = [
  { id: "rich", label: "Rich text", Icon: Type },
  { id: "markdown", label: "Markdown", Icon: FileText },
  { id: "preview", label: "Preview", Icon: Eye },
];

const AUTOSAVE_MS = 1500;

export const WritePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [blog, setBlog] = useState<BlogResponseDTO | null>(null);
  const [blogId, setBlogId] = useState<string | null>(id ?? null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mode, setMode] = useState<EditorMode>("markdown");
  const [isLoaded, setIsLoaded] = useState(!id);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [dirty, setDirty] = useState(false);

  // Mirrors for callbacks (autosave/publish) so they never read stale state
  const blogIdRef = useRef<string | null>(id ?? null);
  const draftValuesRef = useRef({ title, content });
  const isDirtyRef = useRef(false);

  useEffect(() => {
    draftValuesRef.current = { title, content };
  }, [title, content]);

  const setBlogIdState = (next: string) => {
    blogIdRef.current = next;
    setBlogId(next);
  };

  // Load an existing draft / published post
  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    getBlogApi(id)
      .then((loaded) => {
        if (cancelled) return;
        setBlog(loaded);
        setBlogIdState(loaded.id);
        setTitle(loaded.title);
        setContent(loaded.content);
        setIsLoaded(true);
      })
      .catch(() => {
        toast.error("Could not load that story");
        navigate("/profile");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const saveDraft = useCallback(
    async (valuesOverride?: { title: string; content: string }): Promise<string | null> => {
      const values = valuesOverride ?? draftValuesRef.current;
      setIsSaving(true);
      try {
        if (blogIdRef.current) {
          await updateBlogApi(blogIdRef.current, {
            title: values.title,
            content: values.content,
            description: "",
          });
        } else {
          const created = await createBlogApi({
            title: values.title,
            content: values.content,
            description: "",
          });
          setBlogIdState(created.id);
          setBlog(created);
          // Keep the editor mounted; only swap the URL
          window.history.replaceState(null, "", `/write/${created.id}`);
        }
        isDirtyRef.current = false;
        setDirty(false);
        return blogIdRef.current;
      } catch {
        toast.error("Could not save the draft");
        return null;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  // Autosave — every change stays a server-side draft until published
  useEffect(() => {
    if (!isDirtyRef.current || !isLoaded) return;
    const timer = setTimeout(() => {
      void saveDraft();
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [content, title, isLoaded, dirty, saveDraft]);

  const edit = (nextContent: string) => {
    setContent(nextContent);
    isDirtyRef.current = true;
    setDirty(true);
  };

  const editTitle = (nextTitle: string) => {
    setTitle(nextTitle);
    isDirtyRef.current = true;
    setDirty(true);
  };

  // Cross-mode conversions keep markdown as the stored canonical source
  const switchMode = (next: EditorMode) => {
    if (next === mode) return;
    if (next === "rich") setContent(markdownToHtml(content));
    if (next === "markdown" && mode === "rich") setContent(htmlToMarkdown(content));
    setMode(next);
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      toast.error("Add a title before publishing");
      return;
    }
    setIsPublishing(true);
    // Markdown is canonical — if the writer leaves rich-text mode we convert back
    const savedRef = draftValuesRef.current;
    const values =
      mode === "rich"
        ? { title: savedRef.title, content: htmlToMarkdown(savedRef.content) }
        : savedRef;
    setContent(values.content);
    draftValuesRef.current = values;

    const savedId = await saveDraft(values);
    if (!savedId) {
      setIsPublishing(false);
      return;
    }
    try {
      await publishBlogApi(savedId);
      toast.success("Story published");
      navigate("/profile?tab=stories");
    } catch {
      toast.error("Could not publish");
    } finally {
      setIsPublishing(false);
    }
  };

  const words = wordCount(mode === "rich" ? markdownToPlainText(
    content.replace(/<[^>]+>/g, " ")
  ) : content);

  const saveState = isSaving
    ? "Saving…"
    : dirty
      ? "Unsaved changes"
      : blogId
        ? "Draft saved"
        : "Draft";

  return (
    <AppShell>
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-6 md:py-10">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-[13px] text-[#8A8F8B] hover:text-[#1B1F1C]"
          >
            {"< Back"}
          </button>
          <div className="flex items-center gap-3">
            <span className="text-[12px] text-[#8A8F8B]">
              {isLoading
                ? "Loading…"
                : `${saveState} · ${words} words · ${blog?.status === "published" ? "Published" : "Draft"}`}
            </span>
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={isSaving || isPublishing}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#1F3D2F] px-4 text-[13px] font-medium text-white hover:bg-[#2A5240] transition-colors disabled:opacity-50"
            >
              {isPublishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Publish
            </button>
          </div>
        </div>

        <input
          value={title}
          onChange={(e) => editTitle(e.target.value)}
          placeholder="Title"
          aria-label="Story title"
          className="font-editorial w-full border-none bg-transparent text-[32px] sm:text-[40px] leading-tight text-[#1B1F1C] placeholder:text-[#C9C4B8] outline-none"
        />

        <div className="mt-4 mb-5 flex items-center gap-1.5 border-b border-[#E6E2D8] pb-3">
          {MODES.map(({ id: modeId, label, Icon }) => (
            <button
              key={modeId}
              type="button"
              onClick={() => switchMode(modeId)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] transition-colors ${
                mode === modeId
                  ? "bg-[#1F3D2F] text-white"
                  : "text-[#5C625E] hover:bg-[#F0EDE4]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {mode === "markdown" ? (
          <MarkdownEditor value={content} onChange={edit} />
        ) : mode === "rich" ? (
          <RichTextEditor html={content} onInput={edit} />
        ) : (
          <article
            className="prose-preview min-h-100 w-full rounded-xl border border-[#E6E2D8] bg-white px-5 py-4 text-[16px] leading-7 text-[#1B1F1C]"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
          />
        )}
      </main>
    </AppShell>
  );
};

export default WritePage;
