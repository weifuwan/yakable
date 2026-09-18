import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import {
  getEditActivitySnapshot,
  stopActiveEdit,
  subscribeEditActivity,
} from "../api";

type ButtonRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function findComposerSendButton(): HTMLButtonElement | null {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    'textarea[placeholder="Ask Yakable..."]',
  );
  const form = textarea?.closest("form");
  return (
    form?.querySelector<HTMLButtonElement>(
      'button[aria-label="Send message"]',
    ) ?? null
  );
}

function sameRect(left: ButtonRect | null, right: ButtonRect): boolean {
  return Boolean(
    left &&
      Math.abs(left.left - right.left) < 0.25 &&
      Math.abs(left.top - right.top) < 0.25 &&
      Math.abs(left.width - right.width) < 0.25 &&
      Math.abs(left.height - right.height) < 0.25,
  );
}

function SegmentedSpinner() {
  const spokes = Array.from({ length: 12 }, (_, index) => index);

  return (
    <svg
      className="h-[17px] w-[17px] animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {spokes.map((index) => (
        <rect
          key={index}
          x="11.05"
          y="2.25"
          width="1.9"
          height="5.1"
          rx="0.95"
          fill="currentColor"
          opacity={0.18 + (index / (spokes.length - 1)) * 0.82}
          transform={`rotate(${index * 30} 12 12)`}
        />
      ))}
    </svg>
  );
}

export function ComposerRunControl() {
  const activity = useSyncExternalStore(
    subscribeEditActivity,
    getEditActivitySnapshot,
    getEditActivitySnapshot,
  );
  const [buttonRect, setButtonRect] = useState<ButtonRect | null>(null);

  useEffect(() => {
    if (activity.status === "idle") {
      setButtonRect(null);
      return;
    }

    let frame = 0;
    let target: HTMLButtonElement | null = null;

    const syncPosition = () => {
      if (!target?.isConnected) target = findComposerSendButton();

      if (target) {
        const rect = target.getBoundingClientRect();
        const next: ButtonRect = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };
        setButtonRect((current) => (sameRect(current, next) ? current : next));
      } else {
        setButtonRect(null);
      }

      frame = window.requestAnimationFrame(syncPosition);
    };

    syncPosition();
    return () => window.cancelAnimationFrame(frame);
  }, [activity.status]);

  if (activity.status === "idle" || !buttonRect) return null;

  const stopping = activity.status === "stopping";

  return createPortal(
    <button
      type="button"
      className={`grid place-items-center rounded-full border-0 p-0 transition-[background-color,color,box-shadow,transform] duration-150 ${
        stopping
          ? "cursor-wait bg-white text-black/45 shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
          : "cursor-pointer bg-[#20201f] text-white shadow-[0_1px_2px_rgba(0,0,0,0.16)] hover:bg-black active:scale-[0.96]"
      }`}
      style={{
        position: "fixed",
        left: buttonRect.left,
        top: buttonRect.top,
        width: buttonRect.width,
        height: buttonRect.height,
        zIndex: 2147483000,
      }}
      onClick={stopping ? undefined : () => void stopActiveEdit()}
      disabled={stopping}
      aria-label={stopping ? "Stopping generation" : "Stop generation"}
      aria-busy={stopping}
    >
      {stopping ? (
        <SegmentedSpinner />
      ) : (
        <span
          className="h-[9px] w-[9px] rounded-[2px] bg-current"
          aria-hidden="true"
        />
      )}
    </button>,
    document.body,
  );
}
