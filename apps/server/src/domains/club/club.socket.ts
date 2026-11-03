import cookieParser from "cookie-parser";
import type { Namespace, Socket, Server as SocketServer } from "socket.io";
import type {
  ClubMemberDTO,
  ClubMessageDTO,
  ClubPresenceUpdateDTO,
  ClubTypingEventDTO,
} from "@quill/shared";

import TokenService from "../auth/token.service";
import { AUTH_COOKIES } from "../../core/config/cookie.config";
import { logger } from "../../core/logger/logger";
import { ForbiddenError } from "../../core/errors";
import ClubRepository from "./club.repository";
import ClubService from "./club.service";

// Club Chat Hall socket layer. MySQL-style polling is gone: a member opens
// /clubs/:id/chat, the client connects to /socket.io and "club:join"s its
// club room. From then on every send is persisted through the SAME service
// methods the REST endpoints use (membership check, participant healing,
// message insert) and broadcast to the room — so a socket message and a
// multipart image upload (arriving via REST) land in the same feed.

// The access cookie is scoped "/" so the socket.io handshake (same origin or
// same-site dev origin) carries it; we only need its value — never expose it.
const tokenService = new TokenService();
const clubRepo = new ClubRepository();
const clubService = new ClubService();

// Presence counts per club room: userId -> connected members' socket count.
// When the last socket of a user leaves the room we flip their dot offline.
const roomPresence = new Map<string, Map<string, number>>();

const roomFor = (clubId: string) => `club:${clubId}`;
const presenceFor = (clubId: string) => {
  let presence = roomPresence.get(clubId);
  if (!presence) {
    presence = new Map();
    roomPresence.set(clubId, presence);
  }
  return presence;
};

// Namespace-scoped io (the /club-chat namespace, NOT the root server) so
// broadcasts reach sockets that "club:join"ed rooms there — Socket.IO rooms
// live per-namespace, and every chat member is connected to /club-chat.
let io: Namespace | null = null;

/** Broadcast a persisted ClubMessageDTO into the club's chat room.
 * Called by the socket send handler AND by the REST image-upload send. */
export function broadcastClubMessage(clubId: string, message: ClubMessageDTO) {
  io?.to(roomFor(clubId)).emit("club:message", message);
}

async function emitPresenceUpdate(
  clubId: string,
  userId: string,
  online: boolean,
) {
  const update: ClubPresenceUpdateDTO = {
    userId,
    clubId,
    online,
    lastSeenAt: online ? new Date().toISOString() : undefined,
  };
  io?.to(roomFor(clubId)).emit("club:presence", update);
}

/** Every member, paged through service-level pagination (same DTOs the
 * members tab uses, presence computed the same way). Capped defensively. */
async function gatherMembers(clubId: string, userId: string) {
  const all: ClubMemberDTO[] = [];
  let total = Infinity;
  for (let page = 1; page <= 20 && all.length < total; page += 1) {
    const result = await clubService.listMembers(clubId, userId, {
      page,
      limit: 50,
    });
    total = result.total;
    all.push(...result.items);
  }
  return all;
}

// Socket "authentication": the token lives in an httpOnly cookie the browser
// already sends on the websocket handshake. Someone plugging "Bearer" into
// the Extra headers (curl/other API clients) works too.
async function socketAuth(socket: Socket, next: (err?: Error) => void) {
  try {
    // Socket requests aren't Express middleware-chained; run the same parser
    // (without signed-cookie secrets — we only read plain cookie values)
    cookieParser()(socket.request as never, {} as never, () => undefined);

    const authHeader = socket.request.headers.authorization;
    const rawToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : ((socket.request as never as { cookies?: Record<string, string> })
          .cookies?.[AUTH_COOKIES.access.name] as string | undefined);

    if (!rawToken) {
      next(new Error("Not authenticated"));
      return;
    }
    const payload = await tokenService.verifyToken(rawToken);
    if (payload.type !== "access") {
      next(new Error("Invalid token type"));
      return;
    }
    socket.data.userId = payload.userId;
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
}

// Run the club join through the same membership rules the REST chat routes
// enforce (club exists, user is a member, group conversation exists) — the
// service writes rows inside its own transaction, so reopen old rooms is a
// no-op for clubs that already have their group conversation.
async function resolveClubRoom(socket: Socket, clubId: string) {
  const userId = socket.data.userId as string;
  const membership = await clubRepo.getMembership(clubId, userId);
  if (!membership) {
    throw new ForbiddenError("Only club members can join the chat hall");
  }
  const conversation =
    (await clubRepo.getGroupConversation(clubId)) ??
    (await clubRepo.getOrCreateGroupConversation(clubId));
  return { conversationId: conversation.id };
}

async function joinClub(socket: Socket, clubId: string) {
  socket.join(roomFor(clubId));
  const userId = socket.data.userId as string;

  // First socket of this user in this room (reconnect replaced the count)
  const presence = presenceFor(clubId);
  const wasOffline = !(presence.get(userId) ?? 0);
  presence.set(userId, (presence.get(userId) ?? 0) + 1);

  // Both are fire-and-forget: the club history stays identical for everyone
  await Promise.all([
    clubRepo.touchPresence(clubId, userId).catch(() => undefined),
    wasOffline
      ? emitPresenceUpdate(clubId, userId, true)
      : Promise.resolve(),
  ]);
}

async function leaveClub(socket: Socket, clubId: string) {
  const userId = socket.data.userId as string;
  const room = roomFor(clubId);
  socket.leave(room);

  // Drop the last socket of this user → their dot goes grey. A heartbeat
  // stale window (>2 min) covers the in-between.
  const presence = roomPresence.get(clubId);
  if (!presence) return;
  const remaining = (presence.get(userId) ?? 1) - 1;
  if (remaining > 0) {
    presence.set(userId, remaining);
    return;
  }
  presence.delete(userId);
  if (presence.size === 0) roomPresence.delete(clubId);
  await emitPresenceUpdate(clubId, userId, false);
}

function registerClubChatConnection(socket: Socket) {
  const userId = socket.data.userId as string;

  socket.on("club:join", async (clubId: string, ack) => {
    try {
      const { conversationId } = await resolveClubRoom(socket, clubId);
      await joinClub(socket, clubId);

      // History: page 1 = newest; reversed to chronological for rendering,
      // exactly like the REST listMessages pager the client falls back to
      const history = await clubService.listMessages(
        clubId,
        conversationId,
        userId,
        { page: 1, limit: 50 },
      );
      const members = await gatherMembers(clubId, userId);
      ack?.({
        conversationId,
        members,
        messages: [...history.items].reverse(),
        total: history.total,
      });
    } catch (error) {
      logger.warn(
        { error, clubId, userId, socketId: socket.id },
        "club:join rejected",
      );
      ack?.({ error: error instanceof Error ? error.message : "Join failed" });
    }
  });

  socket.on("club:leave", async (clubId: string) => {
    try {
      await leaveClub(socket, clubId);
    } catch (error) {
      logger.warn({ error, clubId, userId }, "club:leave failed");
    }
  });

  socket.on(
    "club:message:send",
    async (
      payload: { clubId: string; conversationId: string; body: string },
      ack,
    ) => {
      try {
        const message = await clubService.sendMessage(
          payload.clubId,
          payload.conversationId,
          userId,
          { body: String(payload.body ?? "") },
        );

        // Persisted first; the room (this socket included) hears it next
        broadcastClubMessage(payload.clubId, message);
        ack?.({ message });
      } catch (error) {
        logger.warn(
          { error, clubId: payload?.clubId, userId },
          "club:message:send rejected",
        );
        ack?.({ error: error instanceof Error ? error.message : "Send failed" });
      }
    },
  );

  socket.on("club:typing", (payload: Omit<ClubTypingEventDTO, "userId">) => {
    if (!payload?.clubId) return;
    // Ephemeral, never persisted — socket.to excludes the sender itself
    const event: ClubTypingEventDTO = {
      clubId: payload.clubId,
      conversationId: payload.conversationId,
      userId,
      typing: Boolean(payload.typing),
    };
    socket.to(roomFor(payload.clubId)).emit("club:typing", event);
  });

  socket.on("club:presence:heartbeat", async (clubId: string, ack) => {
    try {
      await clubRepo.touchPresence(clubId, userId);
      // The heartbeat keeps `last_seen_at` fresh (2-minute online window);
      // the dot itself is only refreshed for viewers if the user was grey
      const online = roomPresence.get(clubId)?.has(userId);
      if (!online) await emitPresenceUpdate(clubId, userId, true);
      ack?.({ success: true });
    } catch (error) {
      logger.warn({ error, clubId, userId }, "presence heartbeat failed");
      ack?.({ success: false });
    }
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room.startsWith("club:")) {
        void leaveClub(socket, room.slice("club:".length));
      }
    }
  });
}

function initClubChatSocket(socketServer: SocketServer) {
  io = socketServer.of("/club-chat");
  io.use(socketAuth).on("connection", registerClubChatConnection);

  logger.info("Club chat socket ready on /club-chat");
}

export default initClubChatSocket;
