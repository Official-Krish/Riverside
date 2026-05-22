import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type Filter, type Notification } from "./types";
import { api } from "./api";
import { getHttpErrorMessage } from "@/lib/httpError";
import { toast } from "sonner";
import { buildMeetingLivePath } from "@/lib/meeting";
import type { JoinMeetingResponse } from "@repo/types/api";

export const notificationsQueryKey = ["notifications"];

export function useNotifications(
  isAuthenticated: boolean,
  name?: string,
  navigate?: (url: string) => void,
) {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<Filter>("All");
  const displayName = name?.trim() || "Guest";
  const prevUnreadRef = useRef(0);

  const notificationsQuery = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: api.getNotifications,
    enabled: isAuthenticated,
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasUnread = data?.some((n) => !n.isRead) ?? false;
      return hasUnread ? 10_000 : 30_000;
    },
  });

  const notifications = useMemo(
    () => notificationsQuery.data ?? [],
    [notificationsQuery.data],
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    const previousUnread = prevUnreadRef.current;

    if (unreadCount > previousUnread && previousUnread > 0) {
      const newCount = unreadCount - previousUnread;
      const newNotifs = notifications
        .filter((n) => !n.isRead)
        .slice(0, newCount);
      for (const n of newNotifs) {
        toast.info(n.message, { duration: 5000 });
      }
    }

    prevUnreadRef.current = unreadCount;
  }, [notifications, unreadCount]);

  const markRead = useMutation({
    mutationFn: api.markRead,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
      const prev = queryClient.getQueryData<Notification[]>(
        notificationsQueryKey,
      );
      queryClient.setQueryData<Notification[]>(
        notificationsQueryKey,
        (old = []) =>
          old.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      queryClient.setQueryData(notificationsQueryKey, ctx?.prev);
      toast.error("Failed to mark notification as read");
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
  });

  const markAllRead = useMutation({
    mutationFn: api.markAllRead,
    onMutate: async (notificationIds) => {
      await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
      const prev = queryClient.getQueryData<Notification[]>(
        notificationsQueryKey,
      );
      queryClient.setQueryData<Notification[]>(
        notificationsQueryKey,
        (old = []) =>
          old.map((n) =>
            notificationIds.includes(n.id) ? { ...n, isRead: true } : n,
          ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      queryClient.setQueryData(notificationsQueryKey, ctx?.prev);
      toast.error("Failed to mark notifications as read");
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
  });

  const deleteNotif = useMutation({
    mutationFn: api.deleteNotification,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
      const prev = queryClient.getQueryData<Notification[]>(
        notificationsQueryKey,
      );
      queryClient.setQueryData<Notification[]>(
        notificationsQueryKey,
        (old = []) => old.filter((n) => n.id !== id),
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      queryClient.setQueryData(notificationsQueryKey, ctx?.prev);
      toast.error("Failed to delete notification");
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
  });

  const deleteAll = useMutation({
    mutationFn: api.deleteAllNotifications,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationsQueryKey });
      const prev = queryClient.getQueryData<Notification[]>(
        notificationsQueryKey,
      );
      queryClient.setQueryData<Notification[]>(notificationsQueryKey, []);
      return { prev };
    },
    onError: (error, _v, ctx) => {
      queryClient.setQueryData(notificationsQueryKey, ctx?.prev);
      toast.error(getHttpErrorMessage(error, "Failed to delete notifications"));
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
  });

  const acceptRecording = useMutation({
    mutationFn: api.approveRecordingRequest,
    onSuccess: async (_d, vars) => {
      await api.deleteNotification(vars.notificationId);
      queryClient.setQueryData<Notification[]>(
        notificationsQueryKey,
        (old = []) => old.filter((n) => n.id !== vars.notificationId),
      );
      toast.success("Recording access approved");
    },
    onError: (error) =>
      toast.error(
        getHttpErrorMessage(error, "Could not approve recording access"),
      ),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
  });

  const acceptInvite = useMutation({
    mutationFn: ({
      targetId,
    }: {
      targetId: string;
      notifId: string;
      devices: {
        micId?: string;
        cameraId?: string;
        initialMicOff?: boolean;
        initialVideoOff?: boolean;
      };
    }) => api.acceptMeetingInvite(targetId),
    onSuccess: (response, vars) => {
      markRead.mutate(vars.notifId);

      if (response.status === 201 || !navigate) {
        toast.message("Waiting for host to start the meeting");
        return;
      }

      const data = response.data as JoinMeetingResponse;
      navigate(
        buildMeetingLivePath({
          roomId: data.roomId,
          name: displayName,
          role: data.isHost ? "host" : "guest",
          recordingState: data.recordingState === "RECORDING",
          micId: vars.devices.micId,
          cameraId: vars.devices.cameraId,
          initialMicOff: vars.devices.initialMicOff,
          initialVideoOff: vars.devices.initialVideoOff,
        }),
      );
    },
    onError: (error) =>
      toast.error(getHttpErrorMessage(error, "Could not join meeting")),
  });

  const declineRecording = useMutation({
    mutationFn: api.denyRecordingRequest,
    onSuccess: async (_d, vars) => {
      await api.deleteNotification(vars.notificationId);
      queryClient.setQueryData<Notification[]>(
        notificationsQueryKey,
        (old = []) => old.filter((n) => n.id !== vars.notificationId),
      );
      toast.success("Recording request declined");
    },
    onError: (error) =>
      toast.error(
        getHttpErrorMessage(error, "Could not decline recording request"),
      ),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
  });

  return {
    notificationsQuery,
    notifications,
    markRead,
    markAllRead,
    deleteNotif,
    deleteAll,
    acceptRecording,
    acceptInvite,
    declineRecording,
    activeFilter,
    setActiveFilter,
  };
}
