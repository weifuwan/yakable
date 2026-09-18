import {
  DEFAULT_CHAT_WIDTH,
  MIN_CHAT_WIDTH,
  clampChatWidth,
} from "./utils";

export type PreviewHeaderMode = "full" | "compact" | "tight" | "collapsed";

export const PREVIEW_HEADER_FULL_WIDTH = 640;
export const PREVIEW_HEADER_COMPACT_WIDTH = 520;
export const PREVIEW_HEADER_COLLAPSED_WIDTH = 400;
export const PREVIEW_PANEL_MIN_WIDTH = PREVIEW_HEADER_COLLAPSED_WIDTH;
export const PREVIEW_PANEL_COLLAPSE_TRIGGER = PREVIEW_PANEL_MIN_WIDTH / 2;
export const PREVIEW_PANEL_REOPEN_TRIGGER = PREVIEW_PANEL_MIN_WIDTH * 0.75;
export const PREVIEW_HEADER_RESTORE_WIDTH = PREVIEW_HEADER_FULL_WIDTH;

export function resolvePreviewHeaderMode(previewWidth: number): PreviewHeaderMode {
  if (!Number.isFinite(previewWidth) || previewWidth <= 0) return "full";
  if (previewWidth >= PREVIEW_HEADER_FULL_WIDTH) return "full";
  if (previewWidth >= PREVIEW_HEADER_COMPACT_WIDTH) return "compact";
  if (previewWidth >= PREVIEW_HEADER_COLLAPSED_WIDTH) return "tight";
  return "collapsed";
}

export function shouldCollapsePreviewPanel(previewWidth: number): boolean {
  return Number.isFinite(previewWidth) && previewWidth <= PREVIEW_PANEL_COLLAPSE_TRIGGER;
}

export function shouldReopenPreviewPanel(previewWidth: number): boolean {
  return Number.isFinite(previewWidth) && previewWidth >= PREVIEW_PANEL_REOPEN_TRIGGER;
}

export function constrainedPreviewWidth(previewWidth: number): number {
  if (!Number.isFinite(previewWidth)) return PREVIEW_PANEL_MIN_WIDTH;
  return Math.max(PREVIEW_PANEL_MIN_WIDTH, previewWidth);
}

export function chatWidthForPreviewWidth(
  totalWidth: number,
  previewWidth: number,
): number {
  if (!Number.isFinite(totalWidth) || totalWidth <= 0) return DEFAULT_CHAT_WIDTH;

  const maxPreviewWidth = totalWidth * (1 - MIN_CHAT_WIDTH / 100);
  const targetPreviewWidth = Math.min(
    Math.max(0, previewWidth),
    maxPreviewWidth,
  );
  const targetChatWidth = ((totalWidth - targetPreviewWidth) / totalWidth) * 100;

  return Math.min(100, Math.max(MIN_CHAT_WIDTH, targetChatWidth));
}

export function restoredChatWidth(totalWidth: number): number {
  if (!Number.isFinite(totalWidth) || totalWidth <= 0) return DEFAULT_CHAT_WIDTH;

  const maxPreviewWidth = totalWidth * (1 - MIN_CHAT_WIDTH / 100);
  const targetPreviewWidth = Math.min(
    PREVIEW_HEADER_RESTORE_WIDTH,
    maxPreviewWidth,
  );
  const targetChatWidth = ((totalWidth - targetPreviewWidth) / totalWidth) * 100;

  return clampChatWidth(Math.min(DEFAULT_CHAT_WIDTH, targetChatWidth));
}
