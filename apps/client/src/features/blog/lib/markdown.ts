// Blog content engine: the canonical source of truth is markdown. The editor
// offers a markdown textarea, a rich-text (contentEditable) mode and a live
// preview; conversions between markdown and HTML keep the storage format stable.

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// inline spans: code, images, links, bold, italic (input already HTML-escaped)
function inline(text: string): string {
  let out = text;
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/g,
    '<img alt="$1" src="$2" />',
  );
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  out = out.replace(/(^|\s)_([^_\n]+)_/g, "$1<em>$2</em>");
  return out;
}

// Canonical markdown -> sanitized HTML (for rich-text mode and the preview)
export function markdownToHtml(md: string): string {
  if (!md.trim()) return "";

  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];

  let para: string[] = [];
  let quote: string[] = [];
  let listItems: string[] = [];
  let listOrdered = false;
  let codeLines: string[] = [];
  let lang = "";

  const flushPara = () => {
    if (para.length) {
      blocks.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      blocks.push(
        `<blockquote>${quote
          .map((l) => `<p>${inline(l)}</p>`)
          .join("")}</blockquote>`,
      );
      quote = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      const tag = listOrdered ? "ol" : "ul";
      blocks.push(
        `<${tag}>${listItems
          .map((i) => `<li>${inline(i)}</li>`)
          .join("")}</${tag}>`,
      );
      listItems = [];
    }
  };
  const flushAll = () => {
    flushPara();
    flushQuote();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (lang) {
      if (line.startsWith("```")) {
        blocks.push(
          `<pre><code class="lang-${lang}">${codeLines.join("\n")}</code></pre>`,
        );
        codeLines = [];
        lang = "";
      } else {
        codeLines.push(escapeHtml(line));
      }
      continue;
    }

    const fence = line.match(/^```\s*([\w-]*)$/);
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const rule = line.match(/^(-{3,}|\*{3,}|_{3,})$/);
    const item = line.match(
      /^(?:[-*+]|\d+[.)])\s+(.*)$/,
    );
    const ordered = !!line.match(/^\d+[.)]\s+/);

    if (fence) {
      flushAll();
      lang = fence[1] || "text";
    } else if (heading) {
      flushAll();
      const level = heading[1].length;
      blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (rule) {
      flushAll();
      blocks.push("<hr />");
    } else if (line.startsWith(">")) {
      flushAll();
      quote.push(line.slice(1).trimStart());
    } else if (item) {
      flushPara();
      flushQuote();
      listOrdered = ordered;
      listItems.push(item[1]);
    } else if (!line.trim()) {
      flushAll();
    } else {
      flushQuote();
      flushList();
      para.push(line);
    }
  }

  if (lang) blocks.push(`<pre><code>${codeLines.join("\n")}</code></pre>`);
  flushAll();

  return blocks.join("\n");
}

// Rich-text -> canonical markdown (best effort on common inline/block nodes)
export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");

  const nodeToMd = (node: Node): string =>
    node.nodeType === Node.TEXT_NODE
      ? (node.textContent ?? "")
      : node.nodeType === Node.ELEMENT_NODE
        ? elementToMd(node as Element)
        : "";

  const children = (node: Element): string =>
    Array.from(node.childNodes).map(nodeToMd).join("");

  function elementToMd(el: Element): string {
    const text = children(el);

    switch (el.tagName.toLowerCase()) {
      case "br":
        return "";
      case "p":
      case "div":
        return text;
      case "h1":
        return `# ${text}`;
      case "h2":
        return `## ${text}`;
      case "h3":
        return `### ${text}`;
      case "h4":
        return `#### ${text}`;
      case "h5":
        return `##### ${text}`;
      case "h6":
        return `###### ${text}`;
      case "strong":
      case "b":
        return `**${text}**`;
      case "em":
      case "i":
        return `*${text}*`;
      case "code":
        return el.closest("pre") ? text : "`" + text + "`";
      case "pre": {
        const code = el.textContent ?? "";
        return code;
      }
      case "blockquote": {
        const inner = htmlToMarkdown(el.innerHTML);
        return inner
          .split("\n")
          .map((l) => (l ? `> ${l}` : ">"))
          .join("\n");
      }
      case "ul":
      case "ol": {
        const items = Array.from(el.querySelectorAll(":scope > li"));
        return items
          .map((li, i) =>
            el.tagName.toLowerCase() === "ol"
              ? `${i + 1}. ${children(li)}`
              : `- ${children(li)}`,
          )
          .join("\n");
      }
      case "a": {
        const href = el.getAttribute("href") ?? "";
        return children(el) ? `[${children(el)}](${href})` : "";
      }
      case "img": {
        const src = el.getAttribute("src") ?? "";
        const alt = el.getAttribute("alt") ?? "";
        return `![${alt}](${src})`;
      }
      case "hr":
        return "---";
      default:
        return text;
    }
  }

  const blocks = Array.from(doc.body.children)
    .map(elementToMd)
    .filter((block) => block.trim().length > 0);

  return blocks.join("\n\n");
}

// Markdown -> plain text (for card excerpts)
export function markdownToPlainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/[*_`~>-]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function readTimeMinutes(words: number): number {
  return Math.max(1, Math.round(words / 200));
}
