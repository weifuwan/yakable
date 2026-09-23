import { describe, expect, it } from 'vitest';

import {
  currentTurnAtReadingAnchor,
  fisheyeScale,
  hitTestRib,
  measureRibLayout,
  ribContentY,
  targetScrollTop,
  type TurnLayoutEntry,
  visibleTurnIds,
} from '../turn-navigation';

function entry(turnId: string, top: number, bottom: number): TurnLayoutEntry {
  return {
    turnId,
    element: document.createElement('section'),
    top,
    bottom,
  };
}

describe('turn-navigation', () => {
  const layout = [entry('turn-1', 0, 300), entry('turn-2', 300, 700), entry('turn-3', 700, 1100)];

  it('selects Current Turn using the 30 percent Reading Anchor', () => {
    expect(currentTurnAtReadingAnchor(layout, 0, 1000)).toBe('turn-2');
    expect(currentTurnAtReadingAnchor(layout, 350, 1000)).toBe('turn-2');
    expect(currentTurnAtReadingAnchor(layout, 500, 1000)).toBe('turn-3');
  });

  it('keeps Visible Turns separate from Current Turn', () => {
    expect(visibleTurnIds(layout, 250, 500)).toEqual(['turn-1', 'turn-2', 'turn-3']);
    expect(currentTurnAtReadingAnchor(layout, 250, 500)).toBe('turn-2');
  });

  it('measures rib hit targets in rail content coordinates', () => {
    const rail = document.createElement('div');
    Object.defineProperties(rail, {
      scrollTop: { configurable: true, writable: true, value: 40 },
    });
    rail.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 180,
        left: 0,
        right: 40,
        width: 40,
        height: 80,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;

    const first = document.createElement('button');
    first.dataset.navTurnId = 'turn-1';
    first.getBoundingClientRect = () =>
      ({
        top: 110,
        bottom: 126,
        left: 0,
        right: 40,
        width: 40,
        height: 16,
        x: 0,
        y: 110,
        toJSON: () => ({}),
      }) as DOMRect;

    const second = document.createElement('button');
    second.dataset.navTurnId = 'turn-2';
    second.getBoundingClientRect = () =>
      ({
        top: 126,
        bottom: 142,
        left: 0,
        right: 40,
        width: 40,
        height: 16,
        x: 0,
        y: 126,
        toJSON: () => ({}),
      }) as DOMRect;

    rail.append(first, second);

    const measured = measureRibLayout(rail);
    expect(measured.map((item) => [item.turnId, item.top, item.bottom])).toEqual([
      ['turn-1', 50, 66],
      ['turn-2', 66, 82],
    ]);

    const pointerY = ribContentY(rail, 130);
    expect(pointerY).toBe(70);
    expect(hitTestRib(measured, pointerY)?.turnId).toBe('turn-2');
  });

  it('keeps Fisheye as a visual scale with bounded influence', () => {
    expect(fisheyeScale(100, 100)).toBeGreaterThan(1);
    expect(fisheyeScale(100, 118)).toBeGreaterThan(1);
    expect(fisheyeScale(100, 136)).toBe(1);
  });

  it('aligns a Turn top to the Reading Anchor and clamps the scroll range', () => {
    expect(targetScrollTop(layout[2], 500, 1400)).toBe(550);
    expect(targetScrollTop(layout[0], 500, 1400)).toBe(0);
    expect(targetScrollTop(entry('turn-last', 1300, 1500), 500, 1400)).toBe(900);
  });
});
