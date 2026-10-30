import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  ListTree,
  Loader2,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "../../../components/layout/AppShell";
import BlogEditor from "../components/BlogEditor";
import {
  cancelScheduleApi,
  createBlogApi,
  getBlogApi,
  publishBlogApi,
  updateBlogApi,
} from "../api/blog.api";
import type { BlogResponseDTO } from "@quill/shared";
import { firstImageFromContent } from "../lib/blog-story";
import { markdownToPlainText, wordCount } from "../lib/markdown";
import { toLocalDateTimeInput } from "../../../lib/datetime";

const AUTOSAVE_MS = 1500;

// BullMQ (Redis) delays are 32-bit ms — the matching server-side cap
const MAX_SCHEDULE_DAYS = 24;

const formatSchedule = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

// Inspector section: a titled block separated by a hairline
const Section = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className="border-b border-[#E6E2D8] px-4 py-4 sm:px-5 sm:py-5 last:border-b-0">
    <h2 className="font-editorial mb-2.5 text-[15px] sm:text-[16px] text-[#1B1F1C]">
      {title}
    </h2>
    {children}
  </section>
);

export const WritePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [blog, setBlog] = useState<BlogResponseDTO | null>(null);
  const [blogId, setBlogId] = useState<string | null>(id ?? null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isLoaded, setIsLoaded] = useState(!id);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [dirty, setDirty] = useState(false);
  const [minScheduleDate, setMinScheduleDate] = useState("");
  // Max mirrors the server's 24-day BullMQ ceiling; both bounds are computed
  // in the click handler (not render) because new Date() is impure
  const [maxScheduleDate, setMaxScheduleDate] = useState("");

  // Scheduling form lives in the inspector; the header button opens it
  const [scheduling, setScheduling] = useState(false);
  const [scheduleInput, setScheduleInput] = useState("");
  const [mobileOutlineOpen, setMobileOutlineOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const inspectorRef = useRef<HTMLElement>(null);

  // Mirrors for callbacks (autosave/publish) so they never read stale state
  // Null until the draft is actually loaded/resolved — initializing to `id`
  // would make the load effect bail out immediately on mount (`blogIdRef.current
  // === id`), leaving the editor empty (a fresh page instead of the draft).
  const blogIdRef = useRef<string | null>(null);
  const draftValuesRef = useRef({ title, content });
  const isDirtyRef = useRef(false);

  useEffect(() => {
    draftValuesRef.current = { title, content };
  }, [title, content]);

  const setBlogIdState = (next: string) => {
    blogIdRef.current = next;
    setBlogId(next);
  };

  // Serialize saves: autosave, publish-now and schedule-share this ref, so two
  // updates for the same draft can never race (publish firing before its
  // creating POST finished was previously possible)
  const saveInFlightRef = useRef<Promise<string | null>>(Promise.resolve(null));

  // Load an existing draft / published post
  useEffect(() => {
    // The URL swap after creating a draft must not re-trigger the load (it
    // would refetch and clobber in-flight edits)
    if (!id || blogIdRef.current === id) return;

    let cancelled = false;
    getBlogApi(id)
      .then((loaded) => {
        if (cancelled || blogIdRef.current === id) return;
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
    async (valuesOverride?: {
      title: string;
      content: string;
    }): Promise<string | null> => {
      // Chain onto any in-flight save instead of racing it
      const previous = saveInFlightRef.current;
      const run = async (): Promise<string | null> => {
        await previous.catch(() => null); // wait, ignore its failures
        const values = valuesOverride ?? draftValuesRef.current;
        // Carry the first embedded image (if any) so it shows on story cards.
        const images = firstImageFromContent(values.content);
        const payload: { title: string; content: string; images?: string[] } = {
          title: values.title,
          content: values.content,
        };
        if (images) payload.images = [images];
        setIsSaving(true);
        try {
          if (blogIdRef.current) {
            // description is intentionally untouched — autosave must not
            // wipe the author's summary field
            await updateBlogApi(blogIdRef.current, payload);
          } else {
            const created = await createBlogApi(payload);
            setBlogIdState(created.id);
            setBlog(created);
            // Keep the editor mounted; only swap the URL (router-aware, with
            // replace so back returns to where the writer came from)
            navigate(`/write/${created.id}`, { replace: true });
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
      };
      saveInFlightRef.current = run();
      return saveInFlightRef.current;
    },
    [navigate],
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

  // Instant publish — straight to the feed
  const handlePublishNow = async () => {
    if (!title.trim()) {
      toast.error("Add a title before publishing");
      return;
    }
    setIsPublishing(true);

    const savedId = await saveDraft({
      title: draftValuesRef.current.title,
      content: draftValuesRef.current.content,
    });
    if (!savedId) {
      setIsPublishing(false);
      return;
    }
    // Already published — editing just saves the update, there is no
    // "publish again" step (the server rejects re-publishing).
    if (isPublished) {
      toast.success("Story updated");
      navigate("/profile?tab=stories");
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

  // Scheduled publish — the worker flips it live when the time comes
  const handleSchedule = async () => {
    if (!title.trim()) {
      toast.error("Add a title before publishing");
      return;
    }
    // datetime-local yields "YYYY-MM-DDTHH:mm" in local time — new Date() parses it as such
    const when = new Date(scheduleInput);
    if (!scheduleInput || Number.isNaN(when.getTime())) {
      toast.error("Pick a valid date and time");
      return;
    }
    if (when.getTime() <= Date.now()) {
      toast.error("Schedule a time in the future");
      return;
    }
    if (when.getTime() - Date.now() > MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000) {
      toast.error("You can schedule up to 24 days ahead");
      return;
    }

    setIsPublishing(true);
    setScheduleInput("");
    const publishAt = when.toISOString();

    const savedId = await saveDraft({
      title: draftValuesRef.current.title,
      content: draftValuesRef.current.content,
    });
    if (!savedId) {
      setIsPublishing(false);
      return;
    }
    try {
      await publishBlogApi(savedId, publishAt);
      toast.success(`Story scheduled for ${formatSchedule(publishAt)}`);
      navigate("/profile?tab=drafts");
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Could not schedule the story",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  // Cancel a pending schedule — the blog stays an ordinary draft
  const handleCancelSchedule = async () => {
    if (!blogId) return;
    try {
      await cancelScheduleApi(blogId);
      setBlog((prev) => (prev ? { ...prev, scheduledPublishAt: null } : prev));
      toast("Schedule cancelled");
    } catch {
      toast.error("Could not cancel the schedule");
    }
  };

  const openScheduler = () => {
    setMinScheduleDate(toLocalDateTimeInput(new Date()));
    setMaxScheduleDate(
      toLocalDateTimeInput(
        new Date(Date.now() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000),
      ),
    );
    setScheduling(true);
    if (window.innerWidth < 1024) {
      setMobileInspectorOpen(true);
    } else {
      requestAnimationFrame(() =>
        inspectorRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        }),
      );
    }
  };

  const scheduledAt = blog?.scheduledPublishAt ?? null;
  const isPublished = blog?.status === "published";
  const words = wordCount(markdownToPlainText(content));
  const readMinutes = Math.max(1, Math.ceil(words / 220));
  const busy = isSaving || isPublishing || isLoading;
  // Disable publish for already-published blogs with no new changes
  const canPublish = !busy && (!isPublished || dirty);

  const saveState = isSaving
    ? "Saving…"
    : dirty
      ? "Unsaved changes"
      : scheduledAt
        ? "Scheduled"
        : blogId
          ? "Draft saved"
          : "Draft";

  const dotClass = isSaving
    ? "bg-[#2A5240] animate-pulse"
    : dirty
      ? "bg-[#C98A2B]"
      : "bg-[#5E9C7B]";

  // Document outline: headings pulled from the markdown source
  const outline = useMemo(
    () =>
      content
        .split("\n")
        .map((line) => /^(#{1,3})\s+(.+)$/.exec(line))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => ({ level: m[1].length, text: m[2].trim() })),
    [content],
  );

  const renderOutlineContent = () => (
    <>
      <div className="mb-3 flex items-baseline justify-between text-[12px] text-[#8A8F8B]">
        <h2 className="font-medium text-[#5C625E]">Outline</h2>
        <span>
          {outline.length} {outline.length === 1 ? "heading" : "headings"}
        </span>
      </div>
      <nav aria-label="Document outline" className="space-y-1">
        <div className="flex items-center gap-2 rounded-md bg-[#F0EDE4] px-2.5 py-1.5 text-[13px] font-medium text-[#1B1F1C]">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#1F3D2F]" />
          <span className="truncate">{title.trim() || "Untitled story"}</span>
        </div>
        {outline.map((item, i) => (
          <div
            key={`${i}-${item.text}`}
            style={{ paddingLeft: `${10 + (item.level - 1) * 12}px` }}
            className="truncate rounded-md py-1.5 pr-2 text-[13px] text-[#5C625E] hover:bg-[#F0EDE4]/60"
          >
            {item.text}
          </div>
        ))}
      </nav>
      {outline.length === 0 && (
        <p className="mt-3 text-[12px] leading-5 text-[#8A8F8B]">
          Headings you add with #, ## or ### show up here.
        </p>
      )}
    </>
  );

  const renderInspectorContent = () => (
    <>
      <div className="border-b border-[#E6E2D8] px-4 py-4 sm:px-5 sm:py-5">
        <h2 className="font-editorial text-[18px] sm:text-[20px] text-[#1B1F1C]">
          Document inspector
        </h2>
        <p className="mt-1 text-[12px] text-[#8A8F8B]">
          {words} {words === 1 ? "word" : "words"} · {readMinutes} min read
        </p>
      </div>

      <Section title="Status">
        <dl className="space-y-2 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-[#8A8F8B]">State</dt>
            <dd className="font-medium text-[#1B1F1C]">
              {isPublished ? "Published" : "Draft"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#8A8F8B]">Saving</dt>
            <dd className="inline-flex items-center gap-1.5 font-medium text-[#1B1F1C]">
              <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
              {isLoading ? "Loading…" : saveState}
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Publish schedule">
        {scheduledAt && (
          <div className="mb-3 rounded-lg border border-[#E6E2D8] bg-white p-3 text-[13px] leading-5 text-[#1B1F1C] shadow-xs">
            <CalendarClock className="mr-1.5 -mt-0.5 inline h-3.5 w-3.5 text-[#8A8F8B]" />
            {formatSchedule(scheduledAt)}
            <button
              type="button"
              onClick={() => void handleCancelSchedule()}
              className="mt-2 block text-[12px] font-medium text-[#ba1a1a] hover:underline"
            >
              Cancel schedule
            </button>
          </div>
        )}

        {scheduling ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSchedule();
            }}
          >
            <label
              htmlFor="schedule-at"
              className="mb-1.5 block text-[12px] font-medium text-[#1B1F1C]"
            >
              Publish at
            </label>
            <input
              id="schedule-at"
              type="datetime-local"
              required
              min={minScheduleDate}
              max={maxScheduleDate}
              value={scheduleInput}
              onChange={(e) => setScheduleInput(e.target.value)}
              className="h-10 w-full rounded-lg border border-[#E6E2D8] bg-white px-2.5 text-[13px] text-[#1B1F1C] outline-none transition-colors focus:border-[#1F3D2F] focus:ring-1 focus:ring-[#1F3D2F]"
            />
            <p className="mt-1.5 text-[11px] text-[#8A8F8B]">
              Up to 24 days ahead.
            </p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setScheduling(false)}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium text-[#5C625E] transition-colors hover:text-[#1B1F1C]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPublishing}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#1F3D2F] px-3.5 text-[12px] font-medium text-white transition-colors hover:bg-[#2A5240] disabled:opacity-50"
              >
                {isPublishing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CalendarClock className="h-3.5 w-3.5" />
                )}
                Schedule
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={openScheduler}
            disabled={busy}
            className="w-full rounded-lg border border-[#E6E2D8] bg-white px-3 py-2.5 text-left text-[13px] text-[#1B1F1C] transition-colors hover:bg-[#F0EDE4] disabled:opacity-50 shadow-xs"
          >
            {scheduledAt ? "Change schedule" : "Pick a date and time"}
            <span className="mt-0.5 block text-[11px] text-[#8A8F8B]">
              Publishes automatically
            </span>
          </button>
        )}
      </Section>
    </>
  );

  return (
    <AppShell>
      {/* Studio bar */}
      <div className="sticky top-16 z-30 border-b border-[#E6E2D8] bg-[#FAF8F2]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-350 items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-2.5">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#5C625E] transition-colors hover:bg-[#F0EDE4] hover:text-[#1B1F1C]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="font-editorial text-[18px] sm:text-[20px] leading-none text-[#1F3D2F] truncate">
              Quill Studio
            </span>

            {/* Mobile quick drawers toggles */}
            <div className="flex items-center gap-1 lg:hidden ml-1">
              <button
                type="button"
                onClick={() => setMobileOutlineOpen((prev) => !prev)}
                className={`inline-flex h-7 items-center gap-1 rounded-full border border-[#E6E2D8] px-2 text-[11px] font-medium transition-colors ${
                  mobileOutlineOpen
                    ? "bg-[#1F3D2F] text-white border-[#1F3D2F]"
                    : "bg-white text-[#5C625E] hover:bg-[#F0EDE4]"
                }`}
                aria-label="Toggle Outline"
              >
                <ListTree className="h-3 w-3" />
                <span className="hidden xs:inline">Outline</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileInspectorOpen((prev) => !prev)}
                className={`inline-flex h-7 items-center gap-1 rounded-full border border-[#E6E2D8] px-2 text-[11px] font-medium transition-colors ${
                  mobileInspectorOpen
                    ? "bg-[#1F3D2F] text-white border-[#1F3D2F]"
                    : "bg-white text-[#5C625E] hover:bg-[#F0EDE4]"
                }`}
                aria-label="Toggle Inspector"
              >
                <SlidersHorizontal className="h-3 w-3" />
                <span className="hidden xs:inline">Details</span>
              </button>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={openScheduler}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1 rounded-full border border-[#E6E2D8] bg-white px-2.5 sm:px-3.5 text-[12px] sm:text-[13px] text-[#1B1F1C] transition-colors hover:bg-[#F0EDE4] disabled:opacity-50"
            >
              <CalendarClock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Schedule</span>
            </button>
            <button
              type="button"
              onClick={() => void handlePublishNow()}
              disabled={!canPublish}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#1F3D2F] px-3 sm:px-4 text-[12px] sm:text-[13px] font-medium text-white transition-colors hover:bg-[#2A5240] disabled:opacity-50 shadow-xs"
            >
              {isPublishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span>Publish</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer: Outline */}
      {mobileOutlineOpen && (
        <div className="border-b border-[#E6E2D8] bg-[#FAF8F2] px-4 py-4 lg:hidden animate-fade-in shadow-inner">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E6E2D8]/60">
            <span className="font-editorial text-[14px] font-medium text-[#1B1F1C]">
              Document Outline
            </span>
            <button
              type="button"
              onClick={() => setMobileOutlineOpen(false)}
              className="p-1 text-[#8A8F8B] hover:text-[#1B1F1C]"
              aria-label="Close outline"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {renderOutlineContent()}
        </div>
      )}

      {/* Mobile Drawer: Inspector */}
      {mobileInspectorOpen && (
        <div className="border-b border-[#E6E2D8] bg-[#FAF8F2] lg:hidden animate-fade-in shadow-inner">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <span className="font-editorial text-[14px] font-medium text-[#1B1F1C]">
              Document Inspector
            </span>
            <button
              type="button"
              onClick={() => setMobileInspectorOpen(false)}
              className="p-1 text-[#8A8F8B] hover:text-[#1B1F1C]"
              aria-label="Close inspector"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {renderInspectorContent()}
        </div>
      )}

      <div className="mx-auto grid max-w-350 gap-0 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        {/* Left: desktop outline */}
        <aside className="hidden border-r border-[#E6E2D8] bg-[#FAF8F2] px-5 py-6 lg:block">
          {renderOutlineContent()}
        </aside>

        {/* Centre: the editor */}
        <main className="min-w-0 px-3 py-5 sm:px-6 sm:py-8 md:px-8 md:py-10">
          <div className="mx-auto max-w-3xl">
            {/* Metadata bar */}
            <div className="mb-4 sm:mb-5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#8A8F8B]">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 font-medium ${
                    isPublished
                      ? "bg-[#1F3D2F] text-white"
                      : "bg-[#F0EDE4] text-[#5C625E]"
                  }`}
                >
                  {isPublished ? "Published" : "Draft"}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 text-[#1B1F1C]"
                  aria-live="polite"
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                  {isLoading ? "Loading…" : saveState}
                </span>
              </div>

              {/* Word & read time pill for mobile */}
              <div className="text-[11px] text-[#8A8F8B] sm:hidden">
                {words}w · {readMinutes}m
              </div>
            </div>

            <input
              value={title}
              onChange={(e) => editTitle(e.target.value)}
              placeholder="Title"
              aria-label="Story title"
              className="font-editorial w-full border-none bg-transparent text-[28px] sm:text-[38px] md:text-[48px] leading-[1.15] tracking-tight text-[#1B1F1C] outline-none placeholder:text-[#C9C4B8]"
            />

            <div className="mt-5 sm:mt-8">
              <BlogEditor value={content} onChange={edit} />
            </div>
          </div>
        </main>

        {/* Right: desktop inspector */}
        <aside
          ref={inspectorRef}
          className="hidden lg:block border-l border-[#E6E2D8] bg-[#FAF8F2]"
          aria-label="Document inspector"
        >
          <div className="sticky top-28">{renderInspectorContent()}</div>
        </aside>
      </div>
    </AppShell>
  );
};

export default WritePage;
