"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ToastTone = "default" | "error";

export type ToastState = {
  message: string;
  tone: ToastTone;
};

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);
  const toastTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current);
    }
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = "default") => {
    clearTimers();
    setToast({ message, tone });
    setVisible(true);

    toastTimerRef.current = window.setTimeout(() => {
      setVisible(false);

      fadeTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, 220);
    }, 3000);
  }, [clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  return {
    toast,
    toastVisible: visible,
    showToast,
  };
}
