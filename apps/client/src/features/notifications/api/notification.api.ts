import type {
  NotificationListDTO,
  UnreadCountDTO,
} from "@quill/shared";
import { API_ROUTES } from "../../../lib/api-routes";
import { fetchWithAuth } from "../../auth/api/auth.api";

// One page of the signed-in user's notifications, newest first
export async function listNotificationsApi(
  page = 1,
  limit = 20,
): Promise<NotificationListDTO> {
  return fetchWithAuth<NotificationListDTO>(
    `${API_ROUTES.NOTIFICATIONS.LIST}?page=${page}&limit=${limit}`,
  );
}

// The unread number on the bell badge
export async function unreadCountApi(): Promise<UnreadCountDTO> {
  return fetchWithAuth<UnreadCountDTO>(API_ROUTES.NOTIFICATIONS.UNREAD_COUNT);
}

// "Mark as read" on a single notification
export async function markNotificationReadApi(id: string): Promise<void> {
  await fetchWithAuth(API_ROUTES.NOTIFICATIONS.READ(id), { method: "PATCH" });
}

// Mark every unread notification read at once
export async function markAllNotificationsReadApi(): Promise<void> {
  await fetchWithAuth(API_ROUTES.NOTIFICATIONS.READ_ALL, { method: "PATCH" });
}

// "Clear" — remove every notification from the list
export async function clearNotificationsApi(): Promise<void> {
  await fetchWithAuth(API_ROUTES.NOTIFICATIONS.LIST, { method: "DELETE" });
}
