// ClubChatPage — the club's Chat Hall (/clubs/:id/chat). A Discord-style
// room that every club member shares: the live socket feed in the middle,
// the presence sidebar (admins/moderators/members) on the right, the
// composer (text + images) at the bottom.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Users,
  WifiOff,
} from "lucide-react";
import type { ClubDTO } from "@quill/shared";
import { AppShell } from "../../../components/layout/AppShell";
import EmptyState from "../../profile/components/EmptyState";
import { getMeApi } from "../../profile/api/profile.api";
import { getClubApi } from "../api/club.api";
import { useClubChatSocket, type ChatStatus } from "../chat/useClubChatSocket";
import ChatMessageList from "../chat/ChatMessageList";
import ChatComposer from "../chat/ChatComposer";
import ChatMembersSidebar from "../chat/ChatMembersSidebar";
import ChatImageLightbox from "../chat/ChatImageLightbox";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

const STATUS_CHIP: Record<ChatStatus, string> = {
  connecting: "bg-[#B27D56]/10 text-[#B27D56]",
  online: "bg-[#3E7A5E]/10 text-[#2A5A46]",
  reconnecting: "bg-[#B27D56]/10 text-[#B27D56]",
  failed: "bg-[#B04A3A]/10 text-[#B04A3A]",
};

const STATUS_LABEL: Record<ChatStatus, string> = {
  connecting: "Connecting…",
  online: "Live",
  reconnecting: "Reconnecting…",
  failed: "Offline",
};

const ClubChatPage = () => {
  const { id } = useParams<{ id: string }>();
  const [club, setClub] = useState<ClubDTO | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );

  const chat = useClubChatSocket(club?.id ?? null);

  // The club (membership gate) and the viewer (own-message alignment)
  useEffect(() => {
    let active = true;
    if (!id) return;
    Promise.all([getClubApi(id), getMeApi()])
      .then(([clubData, me]) => {
        if (!active) return;
        setClub(clubData);
        setCurrentUserId(me.id);
      })
      .catch((e) => {
        if (active) setLoadFailed(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [id]);

  const typingNames = chat.members
    .filter((m) => chat.typingUserIds.includes(m.id))
    .map((m) => m.name);

  const isMember = Boolean(club?.role);

  return (
    <AppShell>
      <main className="flex flex-col">
        <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-270 flex-col px-4 sm:px-6">
          {/* ---------- room header ---------- */}
          <header className="flex flex-wrap items-center gap-3 border-b border-[#E6E2D6] py-3">
            <Link
              to="/my-clubs"
              className="flex items-center gap-1.5 text-[13px] text-[#5C625E] hover:text-[#1F3D2F]"
              aria-label="Back to my clubs"
            >
              <ArrowLeft className="h-4 w-4" />
              My clubs
            </Link>
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-xl bg-[#1F3D2F] font-editorial text-white">
                {club?.name[0] ?? "…"}
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-editorial text-[20px] leading-tight text-[#1B1F1C]">
                  {club?.name ?? "Chat Hall"}
                </h1>
                <p className="flex items-center gap-2 text-[12px] text-[#8A8F8B]">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {club?.memberCount ?? "—"}
                  </span>
                  {club && (
                    <Link
                      to={`/clubs/${club.id}`}
                      className="flex items-center gap-1 hover:text-[#1F3D2F]"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Blogs
                    </Link>
                  )}
                </p>
              </div>
            </div>
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${STATUS_CHIP[chat.status]}`}
              role="status"
            >
              {chat.status === "online" ? (
                <span className="h-1.5 w-1.5 rounded-full bg-[#3E7A5E]" />
              ) : chat.status === "failed" ? (
                <WifiOff className="h-3 w-3" />
              ) : (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {STATUS_LABEL[chat.status]}
            </span>
          </header>

          {/* ---------- body ---------- */}
          {loadFailed ? (
            <div className="py-14">
              <EmptyState
                title="Couldn't open the chat"
                body={loadFailed}
                ctaLabel="Back to my clubs"
                ctaTo="/my-clubs"
              />
            </div>
          ) : !club ? (
            <div className="grid flex-1 place-items-center">
              <Loader2
                className="h-6 w-6 animate-spin text-[#1F3D2F]"
                aria-label="Loading chat"
              />
            </div>
          ) : !isMember ? (
            <div className="py-14">
              <EmptyState
                title="Members only"
                body="The Chat Hall is open to club members. Join the club to share ideas, images and messages here."
                ctaLabel="Back to my clubs"
                ctaTo="/my-clubs"
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-1">
              {/* ---------- message column ---------- */}
              <section className="flex min-w-0 flex-1 flex-col">
                <ChatMessageList
                  messages={chat.messages}
                  currentUserId={currentUserId ?? ""}
                  typingNames={typingNames}
                  hasMore={chat.hasMore}
                  onLoadOlder={() => {
                    void chat.loadOlderMessages();
                  }}
                  onOpenImage={(src, alt) => setLightbox({ src, alt })}
                />
                <ChatComposer
                  disabled={chat.status === "failed"}
                  disabledReason="Chat is offline — reconnecting…"
                  onSendText={(body) => chat.sendMessage(body)}
                  onSendImage={(file, caption) =>
                    chat.sendImageMessage(file, caption)
                  }
                  onTypingChange={chat.setTyping}
                />
              </section>

              {/* ---------- presence sidebar ---------- */}
              <aside className="hidden border-l border-[#E6E2D6] lg:block lg:w-72">
                <ChatMembersSidebar members={chat.members} />
              </aside>
            </div>
          )}
        </div>

        {lightbox && (
          <ChatImageLightbox
            src={lightbox.src}
            alt={lightbox.alt}
            onClose={() => setLightbox(null)}
          />
        )}
      </main>
    </AppShell>
  );
};

export default ClubChatPage;
