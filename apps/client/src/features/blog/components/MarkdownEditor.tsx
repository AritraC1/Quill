import { useRef } from "react";
import { Link as LinkIcon } from "lucide-react";

interface MarkdownEditorProps {
  value: string;
  /** Called with the textarea value on every change */
  onChange: (value: string) => void;
}

// Pure text transforms — the selection state is passed in, so no DOM/refs are
// touched at render time; they only run inside the click handler
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

const insertText = (text: string): Transform => (value, start) => ({
  next: `${value.slice(0, start)}${text}${value.slice(start)}`,
  selectStart: start + text.length,
  selectEnd: start + text.length,
});

const addLink: Transform = (value, start, end) => {
  const url = window.prompt("Link URL") ?? "";
  const selected = value.slice(start, end) || "link";
  return {
    next: `${value.slice(0, start)}[${selected}](${url})${value.slice(start + selected.length)}`,
  };
};

interface ToolAction {
  title: string;
  label: string;
  text?: string;
  transform: Transform;
  icon?: boolean;
}

const ACTIONS: ToolAction[] = [
  { title: "Bold", label: "B", text: "font-bold", transform: wrapWith("**") },
  { title: "Italic", label: "I", text: "italic", transform: wrapWith("*") },
  {
    title: "Heading 1",
    label: "H1",
    text: "font-semibold text-[15px]",
    transform: prefixLines("#"),
  },
  { title: "Heading 2", label: "H2", transform: prefixLines("##") },
  { title: "Quote", label: "\u201D", transform: prefixLines(">") },
  { title: "Bullet list", label: "\u2022", transform: prefixLines("-") },
  { title: "Code", label: "</>", transform: wrapWith("`") },
  { title: "Link", label: "link", transform: addLink, icon: true },
  {
    title: "Horizontal rule",
    label: "\u2014",
    transform: insertText("\n---\n"),
  },
];

export const MarkdownEditor = ({ value, onChange }: MarkdownEditorProps) => {
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // Runs only inside event handlers — selection comes from the textarea
  const apply = (transform: Transform) => {
    const area = areaRef.current;
    const result = transform(
      value,
      area?.selectionStart ?? value.length,
      area?.selectionEnd ?? value.length,
    );

    onChange(result.next);
    if (area) {
      requestAnimationFrame(() => {
        area.focus();
        if (result.selectStart !== undefined && result.selectEnd !== undefined) {
          area.setSelectionRange(result.selectStart, result.selectEnd);
        }
      });
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[#E6E2D8] bg-white focus-within:border-[#8A8F8B]">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[#E6E2D8] bg-[#FAF8F2] px-2 py-1.5">
        {ACTIONS.map(({ title, label, text, transform, icon }) => (
          <button
            key={title}
            type="button"
            title={title}
            aria-label={title}
            // keep the selection alive when clicking toolbar buttons
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(transform)}
            className={`flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] text-[#5C625E] hover:bg-[#F0EDE4] hover:text-[#1B1F1C] ${text ?? ""}`}
          >
            {icon ? (
              <LinkIcon className="h-4 w-4" />
            ) : (
              <span className="font-editorial">{label}</span>
            )}
          </button>
        ))}
      </div>

      <textarea
        ref={areaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          "Start writing in markdown…\n\n# A heading\nSome **bold** and *italic* text.\n"
        }
        className="editor-surface min-h-100 w-full resize-y px-5 py-4 font-mono text-[14px] leading-7 text-[#1B1F1C] outline-none placeholder:text-[#8A8F8B]"
      />
    </div>
  );
};

export default MarkdownEditor;
