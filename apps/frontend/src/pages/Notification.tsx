import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { NotificationCard } from "@/components/Notification/NotificationCard";
import { EmptyState } from "@/components/Notification/Empty";
import { SkeletonCard } from "@/components/Notification/Skeleton";
import { groupByDate } from "@/components/Notification/helpers";
import { NotificationFilters } from "@/components/Notification/NotificationFilters";
import { useNotifications } from "@/components/Notification/useNotifications";
import { getHttpErrorMessage } from "@/lib/httpError";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  formatAbsoluteTimestamp,
  timeAgo,
} from "@/components/Notification/helpers";

export default function NotificationsPage() {
  const { isAuthenticated, name } = useAuth();
  const navigate = useNavigate();
  const {
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
  } = useNotifications(isAuthenticated, name?.trim() || undefined, navigate);

  const filtered = notifications.filter((n) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Unread") return !n.isRead;
    if (activeFilter === "Recording")
      return (
        n.type.startsWith("RECORDING") ||
        n.type.startsWith("RENDER") ||
        n.type.startsWith("MERGE")
      );
    if (activeFilter === "Meeting") return n.type.startsWith("MEETING");
    return true;
  });
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const latestNotification = notifications[0];
  const latestUpdate = latestNotification
    ? timeAgo(latestNotification.createdAt)
    : null;
  const [page, setPage] = useState(1);
  const pageSize = 4;
  const totalPages = Math.ceil(filtered.length / pageSize);
  const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1;
  const paginated = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const grouped = groupByDate(paginated);

  const handleSetActiveFilter = (filter: typeof activeFilter) => {
    setPage(1);
    setActiveFilter(filter);
  };

  const filterLabel =
    activeFilter === "All"
      ? "All notifications"
      : `${activeFilter} notifications`;
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageEnd = Math.min(safePage * pageSize, filtered.length);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090909] px-4 pb-16 pt-10 transition-colors duration-300">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.14),transparent_56%)]" />
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-linear-to-b from-transparent via-white/3 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between gap-4 rounded-[24px] border border-white/8 bg-white/3 px-4 py-3 text-sm text-zinc-400">
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="font-medium text-zinc-200 transition hover:text-white"
            >
              Dashboard
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-400">Notifications</span>
          </div>
          <div className="hidden items-center gap-3 text-xs text-zinc-500 sm:flex">
            <span>{notifications.length} total</span>
            <span className="h-4 w-px bg-white/10" />
            <span>
              {latestUpdate ? `Last update ${latestUpdate}` : "No updates yet"}
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <NotificationFilters
              activeFilter={activeFilter}
              setActiveFilter={handleSetActiveFilter}
              unreadCount={unreadCount}
              notifications={notifications}
            />
          </aside>

          <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,18,0.98),rgba(12,12,12,0.94))] p-5 shadow-[0_18px_80px_rgba(0,0,0,0.38)]">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-100/85">
                    {unreadCount} updates waiting
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50">
                    {filterLabel}
                  </h2>
                  <div className="mt-2 flex items-center gap-3 text-sm text-zinc-500">
                    <span>
                      {unreadCount > 0 ? (
                        <>
                          <span className="font-semibold text-amber-300">
                            {unreadCount} unread
                          </span>
                          {" · "}
                          {notifications.length} total
                        </>
                      ) : (
                        "All caught up"
                      )}
                    </span>
                    <span className="hidden h-4 w-px bg-white/10 sm:block" />
                    <span className="hidden sm:block">
                      {latestNotification
                        ? formatAbsoluteTimestamp(latestNotification.createdAt)
                        : "No activity yet"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <motion.button
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => notificationsQuery.refetch()}
                    disabled={notificationsQuery.isFetching}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-medium text-zinc-200 transition-all duration-150 hover:border-white/15 hover:bg-white/8 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className={`h-3.5 w-3.5 ${notificationsQuery.isFetching ? "animate-spin" : ""}`}
                    >
                      <path d="M8 3a5 5 0 103.466 8.63.5.5 0 10-.688-.725A4 4 0 118 4V2.5a.5.5 0 01.854-.354l2 2a.5.5 0 010 .708l-2 2A.5.5 0 018 6.5V5a3 3 0 100 6 3 3 0 002.598-1.503.5.5 0 11.867.495A4 4 0 118 3z" />
                    </svg>
                    Refresh
                  </motion.button>

                  <AnimatePresence>
                    {notifications.length > 0 && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onClick={() => deleteAll.mutate()}
                        disabled={deleteAll.isPending}
                        className="
                          flex items-center gap-1.5 rounded-xl border border-red-400/20 bg-red-400/10 px-3.5 py-2 text-xs font-medium
                          text-red-100 shadow-[0_12px_24px_rgba(239,68,68,0.08)]
                          transition-all duration-150 hover:bg-red-400/14 active:scale-[0.98] disabled:opacity-50 cursor-pointer
                        "
                      >
                        <svg
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className="w-3.5 h-3.5"
                        >
                          <path d="M6.5 1.5a1 1 0 00-1 1V3h-3a.5.5 0 000 1h.5l.6 9.1A2 2 0 005.6 15h4.8a2 2 0 002-1.9L13 4h.5a.5.5 0 000-1h-3v-.5a1 1 0 00-1-1h-3zM6.5 3V2.5h3V3h-3zM6 6.5a.5.5 0 01.5.5v5a.5.5 0 01-1 0v-5a.5.5 0 01.5-.5zm4 0a.5.5 0 01.5.5v5a.5.5 0 01-1 0v-5a.5.5 0 01.5-.5z" />
                        </svg>
                        Delete all
                      </motion.button>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {unreadCount > 0 && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onClick={() =>
                          markAllRead.mutate(
                            notifications
                              .filter((n) => !n.isRead)
                              .map((n) => n.id),
                          )
                        }
                        disabled={markAllRead.isPending}
                        className="
                      flex items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-2 text-xs font-medium
                      text-emerald-100 shadow-[0_12px_24px_rgba(16,185,129,0.08)]
                      transition-all duration-150 hover:bg-emerald-400/14 active:scale-[0.98] disabled:opacity-50 cursor-pointer
                    "
                      >
                        <svg
                          viewBox="0 0 16 16"
                          fill="currentColor"
                          className="w-3.5 h-3.5"
                        >
                          <path
                            fillRule="evenodd"
                            d="M2.5 3a.5.5 0 000 1h11a.5.5 0 000-1h-11zm0 4a.5.5 0 000 1h11a.5.5 0 000-1h-11zm0 4a.5.5 0 000 1h6a.5.5 0 000-1h-6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Mark all read
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* Notification list */}
            {notificationsQuery.isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : notificationsQuery.isError ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {getHttpErrorMessage(
                  notificationsQuery.error,
                  "Could not load notifications.",
                )}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState filter={activeFilter} />
            ) : (
              <div className="space-y-6">
                <AnimatePresence mode="popLayout">
                  {Object.entries(grouped).map(([date, items]) => (
                    <motion.div
                      key={date}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                          <span className="inline-flex size-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
                          {date}
                        </div>
                        <div className="h-px flex-1 bg-[linear-gradient(90deg,rgba(16,185,129,0.24),rgba(255,255,255,0.06))]" />
                      </div>

                      <div className="space-y-2 pl-2">
                        <AnimatePresence mode="popLayout">
                          {items.map((n) => (
                            <NotificationCard
                              key={n.id}
                              notification={n}
                              onMarkRead={(id) => markRead.mutate(id)}
                              onDelete={(id) => deleteNotif.mutate(id)}
                              onAcceptRecording={(
                                roomId,
                                _requestedBy,
                                notifId,
                              ) =>
                                acceptRecording.mutate({
                                  roomId,
                                  notificationId: notifId,
                                })
                              }
                              onDeclineRecording={(notifId) => {
                                const notification = notifications.find(
                                  (item) => item.id === notifId,
                                );
                                if (!notification?.metadata?.roomId) {
                                  toast.error(
                                    "Missing room information for this request",
                                  );
                                  return;
                                }

                                declineRecording.mutate({
                                  roomId: notification.metadata.roomId,
                                  notificationId: notifId,
                                });
                              }}
                              onAcceptInvite={(targetId, notifId, devices) =>
                                acceptInvite
                                  .mutateAsync({ targetId, notifId, devices })
                                  .then(() => undefined)
                              }
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {filtered.length > 0 ? (
                  <div className="flex flex-col items-center justify-between gap-4 border-t border-white/6 pt-5 sm:flex-row">
                    <p className="text-xs text-zinc-500">
                      Showing {pageStart}-{pageEnd} of {filtered.length}
                    </p>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() =>
                              setPage((currentPage) =>
                                Math.max(1, currentPage - 1),
                              )
                            }
                            aria-disabled={safePage === 1}
                            tabIndex={safePage === 1 ? -1 : 0}
                            className="cursor-pointer"
                          />
                        </PaginationItem>
                        {Array.from({ length: totalPages }).map((_, i) => (
                          <PaginationItem key={i}>
                            <PaginationLink
                              isActive={safePage === i + 1}
                              onClick={() => setPage(i + 1)}
                            >
                              {i + 1}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() =>
                              setPage((currentPage) =>
                                Math.min(totalPages, currentPage + 1),
                              )
                            }
                            aria-disabled={safePage === totalPages}
                            tabIndex={safePage === totalPages ? -1 : 0}
                            className="cursor-pointer"
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
