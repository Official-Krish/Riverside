
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from "@/components/ui/pagination";
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

export default function NotificationsPage() {
  const { isAuthenticated, name } = useAuth();
  const navigate = useNavigate();
  const {
    notificationsQuery,
    notifications,
    markRead,
    markAllRead,
    deleteNotif,
    acceptRecording,
    acceptInvite,
    declineRecording,
    activeFilter,
    setActiveFilter,
  } = useNotifications(isAuthenticated, name?.trim() || undefined, navigate);

  const filtered = notifications.filter((n) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Unread") return !n.isRead;
    if (activeFilter === "Recording") return n.type.startsWith("RECORDING");
    if (activeFilter === "Meeting") return n.type.startsWith("MEETING");
    return true;
  });
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  // Pagination logic
  const [page, setPage] = useState(1);
  const pageSize = 4;
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const grouped = groupByDate(paginated);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090909] px-4 pb-16 pt-10 transition-colors duration-300">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_top,rgba(245,166,35,0.14),transparent_56%)]" />
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/[0.03] to-transparent" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, ease: "easeOut" }}
          className="mb-6 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,22,0.96),rgba(10,10,10,0.94))] p-7 shadow-[0_18px_80px_rgba(0,0,0,0.38)]"
        >
          <div className="gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-amber-200/80">
                Notification Center
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Keep approvals, reminders, and recording activity neatly in view.
              </h1>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                A quieter, production-ready inbox with clearer hierarchy, soft motion, and dashboard-aligned surfaces for faster triage.
              </p>
            </div>
          </div>
        </motion.section>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <NotificationFilters
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
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
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">
                Notifications
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                {unreadCount > 0 ? (
                  <>
                    <span className="font-semibold text-amber-300">{unreadCount} unread</span>
                    {" · "}{notifications.length} total
                  </>
                ) : (
                  "All caught up"
                )}
              </p>
            </div>

            <AnimatePresence>
              {unreadCount > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() =>
                    markAllRead.mutate(
                      notifications.filter((n) => !n.isRead).map((n) => n.id)
                    )
                  }
                  disabled={markAllRead.isPending}
                  className="
                    flex items-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3.5 py-2 text-xs font-medium
                    text-amber-100 shadow-[0_12px_24px_rgba(245,166,35,0.08)]
                    transition-all duration-150 hover:bg-amber-400/14 active:scale-[0.98] disabled:opacity-50
                  "
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M2.5 3a.5.5 0 000 1h11a.5.5 0 000-1h-11zm0 4a.5.5 0 000 1h11a.5.5 0 000-1h-11zm0 4a.5.5 0 000 1h6a.5.5 0 000-1h-6z" clipRule="evenodd" />
                  </svg>
                  Mark all read
                </motion.button>
              )}
            </AnimatePresence>
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
            {getHttpErrorMessage(notificationsQuery.error, "Could not load notifications.")}
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
                  {/* Date label */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      {date}
                    </span>
                    <div className="h-px flex-1 bg-white/[0.06]" />
                  </div>

                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {items.map((n) => (
                        <NotificationCard
                          key={n.id}
                          notification={n}
                          onMarkRead={(id) => markRead.mutate(id)}
                          onDelete={(id) => deleteNotif.mutate(id)}
                          onAcceptRecording={(roomId, _requestedBy, notifId) =>
                            acceptRecording.mutate({ roomId, notificationId: notifId })
                          }
                          onDeclineRecording={(notifId) => {
                            const notification = notifications.find((item) => item.id === notifId);
                            if (!notification?.metadata?.roomId) {
                              toast.error("Missing room information for this request");
                              return;
                            }

                            declineRecording.mutate({
                              roomId: notification.metadata.roomId,
                              notificationId: notifId,
                            });
                          }}
                          onAcceptInvite={(targetId, notifId, devices) =>
                            acceptInvite.mutateAsync({ targetId, notifId, devices }).then(() => undefined)
                          }
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pt-6 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-disabled={page === 1}
                        tabIndex={page === 1 ? -1 : 0}
                        className="cursor-pointer"
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <PaginationItem key={i}>
                        <PaginationLink
                          isActive={page === i + 1}
                          onClick={() => setPage(i + 1)}
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        aria-disabled={page === totalPages}
                        tabIndex={page === totalPages ? -1 : 0}
                        className="cursor-pointer"
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        )}
        </div>
        </div>
      </div>
    </div>
  );
}
