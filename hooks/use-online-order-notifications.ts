"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getOnlineOrderCountAction } from "@/app/actions/online-orders";

const POLL_INTERVAL_MS = 30_000; // Poll every 30 seconds

interface OnlineOrderNotification {
  id: string;
  count: number;
  latestOrderNumber: string | null;
  timestamp: number;
}

export function useOnlineOrderNotifications(initialCount = 0) {
  const [notifications, setNotifications] = useState<OnlineOrderNotification[]>(
    [],
  );
  const [currentCount, setCurrentCount] = useState(initialCount);
  const previousCountRef = useRef(initialCount);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((current) =>
      current.filter((notification) => notification.id !== id),
    );
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const poll = useCallback(async () => {
    try {
      const result = await getOnlineOrderCountAction();
      setCurrentCount(result.count);

      // If count increased, fire notification
      if (result.count > previousCountRef.current) {
        const newOrders = result.count - previousCountRef.current;
        setNotifications((current) => [
          ...current,
          {
            id: `order-${Date.now()}`,
            count: newOrders,
            latestOrderNumber: result.latestOrderNumber,
            timestamp: Date.now(),
          },
        ]);

        // Play notification sound
        try {
          const audioContext = new AudioContext();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          oscillator.frequency.setValueAtTime(
            1000,
            audioContext.currentTime + 0.1,
          );
          oscillator.frequency.setValueAtTime(
            800,
            audioContext.currentTime + 0.2,
          );
          gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 0.4,
          );
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.4);
        } catch {
          // Audio context not available — skip sound
        }
      }

      previousCountRef.current = result.count;
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  useEffect(() => {
    const schedulePoll = () => {
      timeoutRef.current = setTimeout(async () => {
        await poll();
        schedulePoll();
      }, POLL_INTERVAL_MS);
    };

    schedulePoll();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [poll]);

  // Auto-dismiss notifications after 15 seconds
  useEffect(() => {
    if (notifications.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      setNotifications((current) => {
        const cutoff = Date.now() - 15_000;
        return current.filter(
          (notification) => notification.timestamp > cutoff,
        );
      });
    }, 15_000);

    return () => clearTimeout(timer);
  }, [notifications]);

  return {
    notifications,
    currentCount,
    dismissNotification,
    dismissAll,
  };
}
