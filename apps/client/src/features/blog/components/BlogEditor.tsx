import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Eye, FileText, Image as ImageIcon, Link as LinkIcon, Type } from "lucide-react";
import { htmlToMarkdown, markdownToHtml } from "../lib/markdown";
import {
  ASSET_MIME,
  collapseImages,
  expandImages,
  shortImageUrl,
  uploadImages,
  type MediaAsset,
} from "../lib/media";

// One editor for both writing modes. The stored format is always markdown;
// the WYSIWYG surface edits HTML that is converted back to markdown on every
// input, and the markdown surface works on the source directly. Images come
// from the media library (drag, click) or the toolbar's file picker — there is
// no URL prompt.

export interface BlogEditorHandle {
  /** Insert images at the cursor (used by the media library's click-to-insert) */
  insertImages: (assets: MediaAsset[]) => void;
}

interface BlogEditorProps {
  /** Canonical markdown content */
  value: string;
  /** Called with the updated markdown on every change */
  onChange: (markdown: string) => void;
  /** Called when the editor itself uploads files, so the library can list them */
  onAssetsAdded?: (assets: MediaAsset[]) => void;
}

type View = "rich" | "markdown" | "preview";

type Exec = (cmd: string, value?: string) => void;

// Pure text transforms for the markdown surface — the selection state is read
// from the textarea inside the click handler, so no DOM access at render time
type Transform = (
  value: string,
  start: number,
  end: number,
) => { next: string; selectStart?: number; selectEnd?: number };

const wrapWith = (before: string, after = before, placeholder = ""): Transform =>
  (value, start, end) => {
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    return {
      next,
      selectStart: start + before.length,
      selectEnd: start + before.length + selected.length,
    };
  };

const prefixLines = (token: string, placeholder = ""): Transform =>
  (value, start, end) => {
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const selected = value.slice(lineStart, end) || placeholder;
    const next = `${value.slice(0, lineStart)}${token} ${selected}${value.slice(end)}`;
    const cursorAt = lineStart + token.length + 1;
    return { next, selectStart: cursorAt, selectEnd: cursorAt + selected.length };
  };

// Turns every selected line into a list ("- " or "1. ", "2. ", …)
const listTransform = (ordered: boolean): Transform =>
  (value, start, end) => {
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const selected = value.slice(lineStart, end) || "List item";
    const lines = selected.split("\n");
    const marked = lines.map((line, i) => (ordered ? `${i + 1}. ${line}` : `- ${line}`));
    const next = `${value.slice(0, lineStart)}${marked.join("\n")}${value.slice(end)}`;
    return {
      next,
      selectStart: lineStart,
      selectEnd: lineStart + marked.join("\n").length,
    };
  };

const insertAtCursor = (text: string): Transform => (value, start, end) => ({
  next: `${value.slice(0, start)}${text}${value.slice(end)}`,
  selectStart: start + text.length,
  selectEnd: start + text.length,
});

const promptOrEmpty = (message: string) => window.prompt(message) ?? "";

const addLink: Transform = (value, start, end) => {
  const url = promptOrEmpty("Link URL");
  const selected = value.slice(start, end) || "link";
  const next = `${value.slice(0, start)}[${selected}](${url})${value.slice(start + selected.length)}`;
  return { next };
};

const toMarkdownImage = (asset: MediaAsset) => {
  const alt = asset.name.replace(/\.[^.]+$/, "").replace(/[[\]]/g, "");
  return `![${alt}](${shortImageUrl(asset.url)})`;
};

// Moves the caret to the drop point inside the contentEditable surface
const placeCaretAt = (x: number, y: number) => {
  if (typeof document.caretRangeFromPoint !== "function") return;
  const range = document.caretRangeFromPoint(x, y);
  if (!range) return;
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

interface ToolAction {
  key: string;
  title: string;
  /** Markdown-surface handler (textarea transforms) */
  md?: Transform;
  /** WYSIWYG-surface handler (contentEditable commands) */
  rich?: (exec: Exec) => void;
  /** When present the button shows an icon instead of a text label */
  Icon?: typeof LinkIcon;
  label?: string;
  text?: string;
}

const ACTIONS: ToolAction[] = [
  { key: "bold", title: "Bold", label: "B", text: "font-bold", md: wrapWith("**"), rich: (exec) => exec("bold") },
  { key: "italic", title: "Italic", label: "I", text: "italic", md: wrapWith("*"), rich: (exec) => exec("italic") },
  {
    key: "h1",
    title: "Heading 1",
    label: "H1",
    text: "font-semibold text-[15px]",
    md: prefixLines("#"),
    rich: (exec) => exec("formatBlock", "h1"),
  },
  {
    key: "h2",
    title: "Heading 2",
    label: "H2",
    md: prefixLines("##"),
    rich: (exec) => exec("formatBlock", "h2"),
  },
  {
    key: "h3",
    title: "Heading 3",
    label: "H3",
    md: prefixLines("###"),
    rich: (exec) => exec("formatBlock", "h3"),
  },
  {
    key: "quote",
    title: "Quote",
    label: "\u201D",
    md: prefixLines(">"),
    rich: (exec) => exec("formatBlock", "blockquote"),
  },
  { key: "ul", title: "Bullet list", label: "\u2022", md: listTransform(false), rich: (exec) => exec("insertUnorderedList") },
  { key: "ol", title: "Numbered list", label: "1.", md: listTransform(true), rich: (exec) => exec("insertOrderedList") },
  { key: "code", title: "Code", label: "</>", md: wrapWith("`"), rich: (exec) => exec("formatBlock", "pre") },
  {
    key: "link",
    title: "Link",
    Icon: LinkIcon,
    md: addLink,
    rich: (exec) => {
      const url = promptOrEmpty("Link URL");
      if (url) exec("createLink", url);
    },
  },
  // Handled separately: opens the file picker instead of asking for a URL
  { key: "image", title: "Upload image", Icon: ImageIcon },
  {
    key: "hr",
    title: "Horizontal rule",
    label: "\u2014",
    md: insertAtCursor("\n---\n"),
    rich: (exec) => exec("insertHorizontalRule"),
  },
];

const VIEWS: { id: View; label: string; Icon: typeof Type }[] = [
  { id: "rich", label: "Rich text", Icon: Type },
  { id: "markdown", label: "Markdown", Icon: FileText },
  { id: "preview", label: "Preview", Icon: Eye },
];

export const BlogEditor = forwardRef<BlogEditorHandle, BlogEditorProps>(function BlogEditor(
  { value, onChange, onAssetsAdded },
  ref,
) {
  const [view, setView] = useState<View>("markdown");
  const [isOver, setIsOver] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Latest markdown, so inserts that finish after an async upload never
  // overwrite what was typed in the meantime
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // What the markdown textarea displays: images collapsed to ![alt](img:id)
  const displayValue = useMemo(() => collapseImages(value), [value]);

  // WYSIWYG surface: the DOM is authoritative while typing. When the incoming
  // markdown no longer round-trips to what is on screen the value came from
  // outside (loaded draft), so the surface is rebuilt from it.
  useEffect(() => {
    if (view !== "rich") return;
    const el = editorRef.current;
    if (!el) return;
    if (htmlToMarkdown(el.innerHTML) !== value) {
      el.innerHTML = markdownToHtml(value);
    }
  }, [value, view]);

  const pushRich = () => {
    if (!editorRef.current) return;
    onChange(htmlToMarkdown(editorRef.current.innerHTML));
  };

  const exec = (cmd: string, commandValue?: string) => {
    editorRef.current?.focus();
    // document.execCommand is deprecated but remains the only dependency-free
    // way to run a contentEditable WYSIWYG; good enough for this editor scope
    document.execCommand(cmd, false, commandValue);
    pushRich();
  };

  const runMarkdownTransform = (transform: Transform) => {
    const area = areaRef.current;
    // The textarea shows short image tokens, so transforms run on that text
    // and the result is expanded back to full markdown before saving
    const current = collapseImages(valueRef.current);
    const result = transform(
      current,
      area?.selectionStart ?? current.length,
      area?.selectionEnd ?? current.length,
    );

    onChange(expandImages(result.next));
    if (area) {
      requestAnimationFrame(() => {
        area.focus();
        if (result.selectStart !== undefined && result.selectEnd !== undefined) {
          area.setSelectionRange(result.selectStart, result.selectEnd);
        }
      });
    }
  };

  const onAreaKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "i")) {
      e.preventDefault();
      const action = ACTIONS.find((a) => a.key === (e.key === "b" ? "bold" : "italic"));
      if (action?.md) runMarkdownTransform(action.md);
    }
  };

  const canEdit = view === "rich" || view === "markdown";

  const insertImages = (assets: MediaAsset[]) => {
    if (assets.length === 0 || !canEdit) return;
    if (view === "rich") {
      editorRef.current?.focus();
      assets.forEach((asset) => exec("insertImage", asset.url));
      return;
    }
    runMarkdownTransform(insertAtCursor(`\n\n${assets.map(toMarkdownImage).join("\n\n")}\n\n`));
  };

  useImperativeHandle(ref, () => ({ insertImages }));

  // Upload picked or dropped files, list them in the library, insert them
  const addFiles = async (files: File[]) => {
    const added = await uploadImages(files);
    if (added.length === 0) return;
    onAssetsAdded?.(added);
    insertImages(added);
  };

  const onPickFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    void addFiles(files);
  };

  const hasDropPayload = (e: ReactDragEvent<HTMLDivElement>) =>
    Array.from(e.dataTransfer.types).some((t) => t === ASSET_MIME || t === "Files");

  const onDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!canEdit || !hasDropPayload(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsOver(true);
  };

  const onDragLeave = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsOver(false);
  };

  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    setIsOver(false);
    if (!canEdit || !hasDropPayload(e)) return;
    e.preventDefault();
    if (view === "rich") placeCaretAt(e.clientX, e.clientY);

    const raw = e.dataTransfer.getData(ASSET_MIME);
    if (raw) {
      try {
        insertImages([JSON.parse(raw) as MediaAsset]);
      } catch {
        // malformed payload from outside the app — ignore
      }
      return;
    }
    void addFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`rounded-2xl border bg-white transition-colors ${
        isOver
          ? "border-[#1F3D2F] ring-2 ring-[#1F3D2F]/15"
          : "border-[#E6E2D8] focus-within:border-[#8A8F8B]"
      }`}
    >
      {/* Toolbar + view switcher */}
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 rounded-t-2xl border-b border-[#E6E2D8] bg-[#FAF8F2]/95 px-2 py-1.5 backdrop-blur">
        {!canEdit ? (
          <span className="px-2 py-1.5 text-[13px] text-[#8A8F8B]" aria-hidden>
            Read-only preview
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-0.5">
            {ACTIONS.map(({ key, title, label, text, Icon, md, rich }) => {
              const run = () => {
                if (key === "image") {
                  fileInputRef.current?.click();
                } else if (view === "rich") {
                  rich?.(exec);
                } else if (md) {
                  runMarkdownTransform(md);
                }
              };
              return (
                <button
                  key={key}
                  type="button"
                  title={title}
                  aria-label={title}
                  // keep the selection alive when clicking toolbar buttons
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={run}
                  className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] text-[#5C625E] hover:bg-[#F0EDE4] hover:text-[#1B1F1C] ${text ?? ""}`}
                >
                  {Icon ? <Icon className="h-4 w-4" /> : <span className="font-editorial">{label}</span>}
                </button>
              );
            })}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              tabIndex={-1}
              className="hidden"
              onChange={onPickFiles}
            />
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {VIEWS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              onClick={() => setView(id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] transition-colors ${
                view === id
                  ? "bg-[#1F3D2F] text-white"
                  : "text-[#5C625E] hover:bg-[#F0EDE4]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Surfaces */}
      {view === "markdown" ? (
        <textarea
          ref={areaRef}
          value={displayValue}
          onChange={(e) => onChange(expandImages(e.target.value))}
          onKeyDown={onAreaKeyDown}
          placeholder={
            "Start writing in markdown…\n\n# A heading\nSome **bold** and *italic* text.\n"
          }
          className="editor-surface min-h-100 w-full resize-y px-6 py-6 font-mono text-[14px] leading-7 text-[#1B1F1C] outline-none placeholder:text-[#8A8F8B]"
        />
      ) : view === "rich" ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Rich text editor"
          onInput={pushRich}
          onBlur={pushRich}
          className="editor-surface min-h-100 w-full px-6 py-6 text-[16px] leading-7 text-[#1B1F1C] outline-none"
        />
      ) : (
        <article
          className="prose-preview min-h-100 w-full px-6 py-6 text-[16px] leading-7 text-[#1B1F1C]"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(value) }}
        />
      )}
    </div>
  );
});

export default BlogEditor;