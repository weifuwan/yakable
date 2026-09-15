import assert from "node:assert/strict";
import test from "node:test";

import {
  resolvePreviewHeaderMode,
  restoredChatWidth,
  shouldCollapsePreviewPanel,
} from "../dashboard/src/pages/workspace/editor/adaptive-header.js";

test("workspace preview header degrades by available preview width", () => {
  assert.equal(resolvePreviewHeaderMode(800), "full");
  assert.equal(resolvePreviewHeaderMode(600), "compact");
  assert.equal(resolvePreviewHeaderMode(450), "tight");
  assert.equal(resolvePreviewHeaderMode(399), "collapsed");
});

test("preview pane snaps closed once the drag reaches the collapse threshold", () => {
  assert.equal(shouldCollapsePreviewPanel(401), false);
  assert.equal(shouldCollapsePreviewPanel(400), true);
  assert.equal(shouldCollapsePreviewPanel(240), true);
  assert.equal(shouldCollapsePreviewPanel(Number.POSITIVE_INFINITY), false);
});

test("restoring a collapsed preview gives the preview enough room", () => {
  assert.ok(Math.abs(restoredChatWidth(1200) - 45.3) < 0.001);
  assert.ok(Math.abs(restoredChatWidth(1000) - 36) < 0.001);
  assert.ok(Math.abs(restoredChatWidth(700) - 17) < 0.001);
});
