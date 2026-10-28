import { useEffect, useRef } from "react";

interface RichTextEditorProps {
  /** HTML coming from the outside (mode switches / loaded blog) */
  html: string;
  /** Called with the editor's current HTML on every input */
  onInput: (html: string) => void;
}

interface ToolAction {
  label: string;
  title: string;
  text?: string;
  run: (exec: (cmd: string, value?: string) => void) => void;
}

// document.execCommand is deprecated but remains the only dependency-free way
// to run a contentEditable WYSIWYG; good enough for this editor scope
const ACTIONS: ToolAction[] = [
  {
    label: "B",
    title: "Bold",
    text: "font-bold",
    run: (exec) => exec("bold"),
  },
  {
    label: "I",
    title: "Italic",
    text: "italic",
    run: (exec) => exec("italic"),
  },
  {
    label: "H1",
    title: "Heading 1",
    text: "font-semibold text-[15px]",
    run: (exec) => exec("formatBlock", "h1"),
  },
  {
    label: "H2",
    title: "Heading 2",
    text: "font-semibold",
    run: (exec) => exec("formatBlock", "h2"),
  },
  {
    label: "❝",
    title: "Quote",
    run: (exec) => exec("formatBlock", "blockquote"),
  },
  {
    label: "•",
    title: "Bullet list",
    run: (exec) => exec("insertUnorderedList"),
  },
  {
    label: "1.",
    title: "Numbered list",
    run: (exec) => exec("insertOrderedList"),
  },
  {
    label: "</>",
    title: "Code block",
    run: (exec) => exec("formatBlock", "pre"),
  },
  {
    label: "—",
    title: "Horizontal rule",
    run: (exec) => exec("insertHorizontalRule"),
  },
  {
    label: "🔗",
    title: "Link",
    run: (exec) => {
      const url = window.prompt("Link URL");
      if (url) exec("createLink", url);
    },
  },
];

export const RichTextEditor = ({ html, onInput }: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastHtmlRef = useRef(html);

  // Keep the DOM authoritative while typing; sync from props only when the
  // value came from outside (loaded blog / markdown -> rich conversion)
  useEffect(() => {
    const el = editorRef.current;
    if (el && html !== lastHtmlRef.current) {
      el.innerHTML = html;
      lastHtmlRef.current = html;
    }
  }, [html]);

  const pushUp = () => {
    if (!editorRef.current) return;
    lastHtmlRef.current = editorRef.current.innerHTML;
    onInput(lastHtmlRef.current);
  };

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    pushUp();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#E6E2D8] bg-white focus-within:border-[#8A8F8B]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[#E6E2D8] bg-[#FAF8F2] px-2 py-1.5">
        {ACTIONS.map(({ label, title, text, run }) => (
          <button
            key={title}
            type="button"
            title={title}
            aria-label={title}
            // keep the text selection alive when clicking toolbar buttons
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => run(exec)}
            className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] text-[#5C625E] hover:bg-[#F0EDE4] hover:text-[#1B1F1C] ${text ?? ""}`}
          >
            <span className="font-editorial">{label}</span>
          </button>
        ))}
      </div>

      {/* WYSIWYG surface */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Rich text editor"
        onInput={pushUp}
        onBlur={pushUp}
        className="editor-surface min-h-100 w-full px-5 py-4 text-[16px] leading-7 text-[#1B1F1C] outline-none"
      />
    </div>
  );
};

export default RichTextEditor;
