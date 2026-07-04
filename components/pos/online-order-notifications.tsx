"use client";

import Link from "next/link";
import { useOnlineOrderNotifications } from "@/hooks/use-online-order-notifications";

export function OnlineOrderNotifications({
  initialCount = 0,
}: {
  initialCount?: number;
}) {
  const { notifications, dismissNotification, dismissAll } =
    useOnlineOrderNotifications(initialCount);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 print:hidden">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="animate-[toast-slide-in_300ms_ease-out] rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 shadow-[0_20px_60px_-20px_rgba(245,158,11,0.45)] backdrop-blur-xl"
          style={{ maxWidth: 380 }}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 17H5a2 2 0 0 1-1.8-2.9A8 8 0 0 0 4 10a8 8 0 1 1 16 0 8 8 0 0 0 .8 4.1A2 2 0 0 1 19 17h-4" />
                <path d="M9 17a3 3 0 0 0 6 0" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {notification.count === 1
                  ? "New online order!"
                  : `${notification.count} new online orders!`}
              </p>
              {notification.latestOrderNumber ? (
                <p className="mt-1 font-mono text-xs text-amber-700/80">
                  Latest: {notification.latestOrderNumber}
                </p>
              ) : null}
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href="/pos/online-orders"
                  onClick={() => dismissNotification(notification.id)}
                  className="inline-flex h-8 items-center rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
                >
                  View orders →
                </Link>
                <button
                  type="button"
                  onClick={() => dismissNotification(notification.id)}
                  className="inline-flex h-8 items-center rounded-lg border border-amber-200 bg-white/80 px-3 text-xs font-medium text-amber-700 transition-colors hover:bg-white"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismissNotification(notification.id)}
              className="shrink-0 rounded-lg p-1 text-amber-400 transition-colors hover:bg-amber-100 hover:text-amber-600"
              aria-label="Close notification"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}

      {notifications.length > 1 ? (
        <button
          type="button"
          onClick={dismissAll}
          className="self-end text-xs font-medium text-amber-600 hover:text-amber-700"
        >
          Dismiss all
        </button>
      ) : null}
    </div>
  );
}
