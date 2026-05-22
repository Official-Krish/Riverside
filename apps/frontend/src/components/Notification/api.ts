import { http } from "@/https";
import type { NotificationActionInput, NotificationsResponse } from "./types";
import type { Notification as AppNotification } from "./types";

export const api = {
  getNotifications: (): Promise<AppNotification[]> =>
    http.get<NotificationsResponse>("/notifications").then((response) =>
      response.data.notifications.map((notification) => ({
        ...notification,
        metadata: notification.metadata ?? undefined,
      })),
    ),

  markRead: (id: string): Promise<void> =>
    http
      .post("/notifications/mark-as-read", { notificationIds: [id] })
      .then(() => undefined),

  markAllRead: (notificationIds: string[]): Promise<void> =>
    http
      .post("/notifications/mark-as-read", { notificationIds })
      .then(() => undefined),

  deleteNotification: (id: string): Promise<void> =>
    http
      .delete("/notifications/delete", { data: { notificationIds: [id] } })
      .then(() => undefined),

  deleteAllNotifications: (): Promise<void> =>
    http.delete("/notifications/clear").then(() => undefined),

  approveRecordingRequest: ({
    roomId,
    notificationId,
  }: NotificationActionInput): Promise<void> =>
    http
      .post("/notifications/create", {
        type: "RECORDING_REQUEST_APPROVED",
        roomId,
        notificationId,
      })
      .then(() => undefined),

  denyRecordingRequest: ({
    roomId,
    notificationId,
  }: NotificationActionInput): Promise<void> =>
    http
      .post("/notifications/create", {
        type: "RECORDING_REQUEST_DENIED",
        roomId,
        notificationId,
      })
      .then(() => undefined),

  acceptMeetingInvite: (targetId: string) =>
    http.post(`/meeting/join/${targetId}`, {}),
};
