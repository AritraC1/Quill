// Chat Hall composer — text, images or a captioned image. Enter sends,
// Shift+Enter breaks the line; the selected image shows as a removable
// preview strip before it rides the multipart upload.
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Image, Loader2, Send, X } from "lucide-react";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // mirrors the server's multer limit

interface ChatComposerProps {
  disabled?: boolean;
  disabledReason?: string;
  placeholder?: string;
  onSendText(body: string): Promise<void> | void;
  onSendImage(file: File, caption?: string): Promise<void> | void;
  onTypingChange(typing: boolean): void;
}

const ChatComposer = ({
  disabled = false,
  disabledReason,
  placeholder = "Share an idea, a draft, or an image…",
  onSendText,
  onSendImage,
  onTypingChange,
}: ChatComposerProps) => {
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const blocked = disabled || sending;

  const pickImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // re-selecting the same file must still work
    setError(null);
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Only JPG, PNG, GIF or WebP images are allowed");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Images can be at most 5 MB");
      return;
    }
    setPendingImage(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingImage(null);
    setPreviewUrl(null);
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (blocked || (!trimmed && !pendingImage)) return;

    setSending(true);
    try {
      if (pendingImage) {
        await onSendImage(pendingImage, trimmed);
        clearImage();
      } else {
        await onSendText(trimmed);
      }
      setText("");
      onTypingChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message failed to send");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="border-t border-[#E6E2D6] bg-[#FBFAF6] px-3 py-3 sm:px-5">
      {error && (
        <p className="mb-2 text-[12px] text-[#B04A3A]" role="alert">
          {error}
        </p>
      )}

      {pendingImage && previewUrl && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#D9D4C5] bg-white p-2">
          <img
            src={previewUrl}
            alt="Selected attachment"
            className="h-12 w-12 rounded-lg object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] text-[#1B1F1C]">
              {pendingImage.name}
            </p>
            <p className="text-[11px] text-[#8A8F8B]">
              {(pendingImage.size / 1024 / 1024).toFixed(1)} MB ·{" "}
              {text.trim() ? "caption below" : "no caption"}
            </p>
          </div>
          <button
            type="button"
            onClick={clearImage}
            disabled={sending}
            aria-label="Remove selected image"
            className="rounded-full p-1.5 text-[#8A8F8B] hover:bg-[#F0EDE4]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={pickImage}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={blocked}
          aria-label="Attach an image"
          title="Attach an image (max 5 MB)"
          className="shrink-0 rounded-full border border-[#D9D4C5] bg-white p-2.5 text-[#5C625E] hover:bg-[#F0EDE4] disabled:opacity-40"
        >
          <Image className="h-4.5 w-4.5" />
        </button>

        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value.slice(0, 5_000)); // DB CHECK parity
            onTypingChange(e.target.value.trim().length > 0);
          }}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
          placeholder={disabled ? disabledReason : placeholder}
          aria-label="Message input"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-[#D9D4C5] bg-white px-3.5 py-2.5 text-[14px] leading-5 text-[#1B1F1C] placeholder:text-[#8A8F8B] focus:outline-2 focus:outline-[#1F3D2F] disabled:opacity-50"
        />

        <button
          type="button"
          onClick={() => {
            void submit();
          }}
          disabled={blocked || (!text.trim() && !pendingImage)}
          aria-label="Send message"
          className="flex shrink-0 items-center gap-1 rounded-full bg-[#1F3D2F] p-2.5 text-white hover:bg-[#2A5240] disabled:opacity-40"
        >
          {sending ? (
            <Loader2 className="h-4.5 w-4.5 animate-spin" />
          ) : (
            <Send className="h-4.5 w-4.5" />
          )}
        </button>
      </div>
    </div>
  );
};

export default ChatComposer;
