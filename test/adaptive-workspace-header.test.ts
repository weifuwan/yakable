import assert from "node:assert/strict";
import test from "node:test";

import {
  PREVIEW_PANEL_COLLAPSE_TRIGGER,
  PREVIEW_PANEL_MIN_WIDTH,
  PREVIEW_PANEL_REOPEN_TRIGGER,
  chatWidthForPreviewWidth,
  constrainedPreviewWidth,
  resolvePreviewHeaderMode,
  restoredChatWidth,
  shouldCollapsePreviewPanel,
  shouldReopenPreviewPanel,
} from "../dashboard/src/pages/workspace/editor/adaptive-header.js";

test("workspace preview header degrades by available preview width", () => {
  assert.equal(resolvePreviewHeaderMode(800), "full");
  assert.equal(resolvePreviewHeaderMode(600), "compact");
  assert.equal(resolvePreviewHeaderMode(450), "tight");
  assert.equal(resolvePreviewHeaderMode(399), "collapsed");
});

test("preview resize holds at min width before snapping closed", () => {
  assert.equal(PREVIEW_PANEL_MIN_WIDTH, 400);
  assert.equal(PREVIEW_PANEL_COLLAPSE_TRIGGER, 200);
  assert.equal(constrainedPreviewWidth(520), 520);
  assert.equal(constrainedPreviewWidth(400), 400);
  assert.equal(constrainedPreviewWidth(260), 400);
  assert.equal(shouldCollapsePreviewPanel(201), false);
  assert.equal(shouldCollapsePreviewPanel(200), true);
});

test("collapsed preview reopens with hysteresis while the drag is still active", () => {
  assert.equal(PREVIEW_PANEL_REOPEN_TRIGGER, 300);
  assert.equal(shouldReopenPreviewPanel(299), false);
  assert.equal(shouldReopenPreviewPanel(300), true);
  assert.equal(shouldReopenPreviewPanel(420), true);
});

test("pointer resize can hold a fixed pixel preview on wide workspaces", () => {
  assert.ok(Math.abs(chatWidthForPreviewWidth(1600, 400) - 75) < 0.001);
  assert.ok(Math.abs(chatWidthForPreviewWidth(1200, 400) - 66.6666667) < 0.001);
});

test("restoring a collapsed preview gives the preview enough room", () => {
  assert.ok(Math.abs(restoredChatWidth(1200) - 45.3) < 0.001);
  assert.ok(Math.abs(restoredChatWidth(1000) - 36) < 0.001);
  assert.ok(Math.abs(restoredChatWidth(700) - 17) < 0.001);
});
