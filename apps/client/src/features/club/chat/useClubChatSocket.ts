// Club Chat Hall socket layer (client side). One socket per open club page:
// connect to the /club-chat namespace, "club:join" the room, then react to
// messages, presence dots and typing — plus a ~30s heartbeat that keeps
// club_members.last_seen_at fresh on the server.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  ClubMemberDTO,
  ClubMessageDTO,
  ClubPresenceUpdateDTO,
  ClubTypingEventDTO,
} from "@quill/shared";

import { API_ORIGIN } from "../../auth/api/auth.api";
import {
  listClubMessagesApi,
  sendClubImageMessageApi,
  sendClubMessageApi,
} from "../api/club.api";

const PAGE_SIZE = 50; // mirrors the club socket join's history page
const HEARTBEAT_MS = 30_000; // server window is 2 minutes
const TYPING_CLEAR_MS = 4_500;
const TYPING_EMIT_THROTTLE_MS = 2_000;

export type ChatStatus = "connecting" | "online" | "reconnecting" | "failed";

interface JoinAck {
  conversationId: string;
  members: ClubMemberDTO[];
  messages: ClubMessageDTO[]; // newest-first, reversed back to chronological
  total: number;
}

function joinError(ack: unknown): string | null {
  if (ack && typeof ack === "object" && "error" in ack) {
    return String((ack as { error: unknown }).error || "Join failed");
  }
  return null;
}

/** Merge a (possibly newest-first) history page into the chronological feed
 * without duplicating a message the live broadcast may already have delivered */
function mergeFeed(
  current: ClubMessageDTO[],
  incoming: ClubMessageDTO[],
): ClubMessageDTO[] {
  const known = new Set(current.map((m) => m.id));
  const merged = [...current];
  for (const message of incoming) {
    if (!known.has(message.id)) {
      known.add(message.id);
      merged.push(message);
    }
  }
  return merged.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export interface ClubChatSocketApi {
  status: ChatStatus;
  /** The club-wide group conversation id (send target) */
  conversationId: string | null;
  messages: ClubMessageDTO[];
  totalMessages: number;
  hasMore: boolean;
  members: ClubMemberDTO[];
  typingUserIds: string[];
  /** Socket send while connected; REST fallback when the socket is down */
  sendMessage(body: string): Promise<void>;
  /** Images always ride multipart REST (socket carries text only) */
  sendImageMessage(file: File, caption?: string): Promise<void>;
  setTyping(typing: boolean): void;
  loadOlderMessages(): Promise<void>;
}

export function useClubChatSocket(clubId: string | null): ClubChatSocketApi {
  const [status, setStatus] = useState<ChatStatus>("connecting");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ClubMessageDTO[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [members, setMembers] = useState<ClubMemberDTO[]>([]);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const typingTimers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const lastTypingSentAt = useRef(0);
  const typingActive = useRef(false);

  const upsertMessage = useCallback((incoming: ClubMessageDTO) => {
    setMessages((prev) => {
      const index = prev.findIndex((m) => m.id === incoming.id);
      if (index === -1) return [...prev, incoming];
      const next = [...prev];
      next[index] = incoming; // refresh (e.g. deleted flag) in place
      return next;
    });
  }, []);

  useEffect(() => {
    if (!clubId) return;
    const timers = typingTimers.current;

    // Same origin as the REST API: browsers attach the auth cookies to the
    // websocket handshake automatically (withCredentials on cross-origin dev)
    const socket = io(`${API_ORIGIN}/club-chat`, {
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: 1_000,
    });
    socketRef.current = socket;

    const joinRoom = () => {
      setStatus("online");
      socket.emit("club:join", clubId, (ack: unknown) => {
        const error = joinError(ack);
        if (error || !ack) {
          // 403-equivalent: the user lost membership — nothing to chat into
          console.warn("club:join rejected", error);
          return;
        }
        const joined = ack as JoinAck;
        setConversationId(joined.conversationId);
        setMembers(joined.members);
        setMessages((prev) => mergeFeed(prev, [...joined.messages].reverse()));
        setTotalMessages(joined.total);
      });
      socket.emit("club:presence:heartbeat", clubId);
    };

    socket.on("connect", joinRoom);
    socket.on("reconnect_attempt", () => setStatus("reconnecting"));
    socket.on("connect_error", () => {
      if (!socketRef.current?.connected) setStatus("failed");
    });
    socket.on("disconnect", () => setStatus("reconnecting"));

    socket.on("club:message", (message: ClubMessageDTO) => {
      upsertMessage(message);
      setTotalMessages((total) => total + 1);
    });

    socket.on("club:presence", (update: ClubPresenceUpdateDTO) => {
      setMembers((prev) =>
        prev.map((member) =>
          member.id === update.userId
            ? {
                ...member,
                online: update.online,
                lastSeenAt: update.lastSeenAt ?? member.lastSeenAt ?? null,
              }
            : member,
        ),
      );
    });

    socket.on("club:typing", (event: ClubTypingEventDTO) => {
      const existing = timers.get(event.userId);
      if (existing) {
        clearTimeout(existing);
        timers.delete(event.userId);
        setTypingUserIds((prev) => prev.filter((id) => id !== event.userId));
      }
      if (event.typing) {
        setTypingUserIds((prev) =>
          prev.includes(event.userId) ? prev : [...prev, event.userId],
        );
        timers.set(
          event.userId,
          setTimeout(() => {
            timers.delete(event.userId);
            setTypingUserIds((prev) => prev.filter((id) => id !== event.userId));
          }, TYPING_CLEAR_MS),
        );
      }
    });

    const heartbeat = setInterval(() => {
      if (socket.connected) socket.emit("club:presence:heartbeat", clubId);
    }, HEARTBEAT_MS);

    return () => {
      clearInterval(heartbeat);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      // Tell the room we're gone so the presence dot drops immediately
      if (socket.connected) socket.emit("club:leave", clubId);
      socket.disconnect();
      socketRef.current = null;
      setTypingUserIds([]);
    };
  }, [clubId, upsertMessage]);

  // ---------- outgoing ----------

  const sendMessage = useCallback(
    async (body: string) => {
      const trimmed = body.trim();
      if (!clubId || !conversationId || !trimmed) return;

      // Socket first (fast path); the ack carries the persisted message, so
      // upsert it immediately — WhatsApp-style, the sender's bubble shows
      // without waiting for (or depending on) the room broadcast, which
      // dedupes against this by id anyway
      const socket = socketRef.current;
      if (socket?.connected) {
        await new Promise<void>((resolve, reject) => {
          socket.emit(
            "club:message:send",
            { clubId, conversationId, body: trimmed },
            (ack: { error?: string; message?: ClubMessageDTO } | undefined) => {
              if (ack?.error) reject(new Error(ack.error));
              else {
                if (ack?.message) upsertMessage(ack.message);
                resolve();
              }
            },
          );
        });
        return;
      }

      await sendClubMessageApi(clubId, conversationId, trimmed)
        .then((message) => {
          upsertMessage(message);
        });
    },
    [clubId, conversationId, upsertMessage],
  );

  const sendImageMessage = useCallback(
    async (file: File, caption?: string) => {
      if (!clubId || !conversationId) {
        throw new Error("Chat is still connecting — try again in a moment");
      }
      const message = await sendClubImageMessageApi(
        clubId,
        conversationId,
        file,
        caption,
      );
      upsertMessage(message); // dedupes against the broadcast
    },
    [clubId, conversationId, upsertMessage],
  );

  const setTyping = useCallback(
    (typing: boolean) => {
      const socket = socketRef.current;
      if (!socket?.connected || !clubId || !conversationId) return;

      // Don't spam the room — re-announce at most every 2s while typing,
      // but always stop once, so the indicator can't get stuck on
      if (typing && Date.now() - lastTypingSentAt.current < TYPING_EMIT_THROTTLE_MS)
        return;
      if (!typing && !typingActive.current) return;

      typingActive.current = typing;
      lastTypingSentAt.current = Date.now();
      socket.emit("club:typing", {
        clubId,
        conversationId,
        typing,
      });
    },
    [clubId, conversationId],
  );

  const loadOlderMessages = useCallback(async () => {
    if (!clubId || !conversationId || loadingOlder) return;
    const knownCount = messages.length;
    if (totalMessages && knownCount >= totalMessages) return;

    setLoadingOlder(true);
    try {
      const page = Math.floor(knownCount / PAGE_SIZE) + 1;
      const result = await listClubMessagesApi(clubId!, conversationId!, {
        page,
        limit: PAGE_SIZE,
      });
      // Items are newest-first; chronological merge keeps the feed stable
      setMessages((prev) => mergeFeed(prev, [...result.items].reverse()));
      setTotalMessages(result.total);
    } finally {
      setLoadingOlder(false);
    }
  }, [clubId, conversationId, loadingOlder, messages.length, totalMessages]);

  return useMemo(
    () => ({
      status,
      conversationId,
      messages,
      totalMessages,
      hasMore: totalMessages > messages.length,
      members,
      typingUserIds,
      sendMessage,
      sendImageMessage,
      setTyping,
      loadOlderMessages,
    }),
    [
      status,
      conversationId,
      messages,
      totalMessages,
      members,
      typingUserIds,
      sendMessage,
      sendImageMessage,
      setTyping,
      loadOlderMessages,
    ],
  );
}
