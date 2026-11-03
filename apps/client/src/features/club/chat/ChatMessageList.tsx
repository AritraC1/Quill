// Chat Hall message list — chronological feed with day separators, image
// attachments, deleted-message placeholders, typing indicator and a
// "load earlier" trigger that stops fighting the user's scroll position.
import { useEffect, useRef } from "react";
import { ImageOff } from "lucide-react";
import type { ClubMessageDTO } from "@quill/shared";
import { assetUrl } from "../../auth/api/auth.api";
import { getInitials } from "../../../lib/initials";

interface ChatMessageListProps {
  messages: ClubMessageDTO[];
  currentUserId: string;
  typingNames: string[];
  hasMore: boolean;
  onLoadOlder(): void;
  onOpenImage(url: string, alt: string): void;
}

const dayLabel = (iso: string): string => {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const same = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
  if (same(date, today)) return "Today";
  if (same(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
};

const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

const SenderAvatar = ({ message }: { message: ClubMessageDTO }) => {
  const src = assetUrl(message.sender.avatar);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-[#B27D56] font-editorial text-[12px] text-white">
      {getInitials(message.sender.name) || "?"}
    </div>
  );
};

const Attachment = ({
  url,
  alt,
  onOpen,
}: {
  url: string;
  alt: string;
  onOpen: () => void;
}) => (
  <button
    type="button"
    onClick={onOpen}
    aria-label="Open attached image"
    className="group relative mt-1 block max-w-[280px] overflow-hidden rounded-xl border border-[#E6E2D6]"
  >
    <img
      src={assetUrl(url)}
      alt={alt}
      loading="lazy"
      className="max-h-64 w-auto object-cover transition-transform group-hover:scale-[1.02]"
    />
  </button>
);

const ChatMessageList = ({
  messages,
  currentUserId,
  typingNames,
  hasMore,
  onLoadOlder,
  onOpenImage,
}: ChatMessageListProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const lastCountRef = useRef(0);

  // Auto-scroll offers itself ONLY when the reader is already near the
  // bottom — reading old history is never interrupted by a new message
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const added = messages.length - lastCountRef.current;
    lastCountRef.current = messages.length;
    if (added > 0 && stickToBottom.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const onScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    stickToBottom.current =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight <
      80;
  };

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto px-3 py-3 sm:px-5"
    >
      {hasMore && (
        <div className="mb-2 flex justify-center">
          <button
            type="button"
            onClick={onLoadOlder}
            className="rounded-full border border-[#D9D4C5] bg-white px-3 py-1.5 text-[12px] text-[#5C625E] hover:bg-[#F0EDE4] transition-colors"
          >
            Load earlier messages
          </button>
        </div>
      )}

      {messages.length === 0 && (
        <p className="py-10 text-center text-[14px] text-[#8A8F8B]">
          No messages yet — start the conversation.
        </p>
      )}

      {messages.map((message, i) => {
        const own = message.sender.id === currentUserId;
        const previous = messages[i - 1];
        const newDay =
          !previous ||
          new Date(previous.createdAt).toDateString() !==
            new Date(message.createdAt).toDateString();
        // Collapse consecutive rows from the same sender within 5 minutes
        const grouped =
          !newDay &&
          previous?.sender.id === message.sender.id &&
          new Date(message.createdAt).getTime() -
            new Date(previous.createdAt).getTime() <
            5 * 60 * 1000;

        return (
          <div key={message.id}>
            {newDay && (
              <div className="my-3 flex items-center gap-3">
                <span className="h-px flex-1 bg-[#E6E2D6]" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-[#8A8F8B]">
                  {dayLabel(message.createdAt)}
                </span>
                <span className="h-px flex-1 bg-[#E6E2D6]" />
              </div>
            )}

            <div
              className={`flex items-end gap-2 ${own ? "flex-row-reverse" : ""} ${grouped ? "mt-0.5" : "mt-2"}`}
            >
              {grouped ? (
                <span className="w-8 shrink-0" aria-hidden />
              ) : (
                <SenderAvatar message={message} />
              )}

              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[14px] leading-5 ${
                  own
                    ? "rounded-br-md bg-[#1F3D2F] text-[#FBFAF6]"
                    : "rounded-bl-md bg-white text-[#1B1F1C] border border-[#E6E2D6]"
                }`}
              >
                {!own && !grouped && (
                  <p className="mb-0.5 text-[12px] font-medium text-[#5C6B4F]">
                    {message.sender.name}
                  </p>
                )}

                {message.deleted ? (
                  <p className="flex items-center gap-1.5 italic opacity-70">
                    <ImageOff className="w-3.5 h-3.5" />
                    Message removed by a moderator
                  </p>
                ) : (
                  <>
                    {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
                    {message.attachmentUrl && (
                      <Attachment
                        url={message.attachmentUrl}
                        alt={`Image from ${message.sender.name}`}
                        onOpen={() =>
                          onOpenImage(message.attachmentUrl!, message.body || "Shared image")
                        }
                      />
                    )}
                  </>
                )}

                <p
                  className={`mt-0.5 text-right text-[10px] ${
                    own ? "text-[#A8D5BA]/80" : "text-[#8A8F8B]"
                  }`}
                  title={new Date(message.createdAt).toLocaleString()}
                >
                  {clock(message.createdAt)}
                </p>
              </div>
            </div>
          </div>
        );
      })}

      {typingNames.length > 0 && (
        <p className="mt-2 text-[12px] italic text-[#8A8F8B]" aria-live="polite">
          {typingNames.length === 1
            ? `${typingNames[0]} is typing…`
            : `${typingNames.slice(0, 2).join(", ")}${
                typingNames.length > 2 ? " and others" : ""
              } are typing…`}
        </p>
      )}
    </div>
  );
};

export default ChatMessageList;
