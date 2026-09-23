import { describe, expect, it } from 'vitest';

import {
  currentTurnAtReadingAnchor,
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

  it('aligns a Turn top to the Reading Anchor and clamps the scroll range', () => {
    expect(targetScrollTop(layout[2], 500, 1400)).toBe(550);
    expect(targetScrollTop(layout[0], 500, 1400)).toBe(0);
    expect(targetScrollTop(entry('turn-last', 1300, 1500), 500, 1400)).toBe(900);
  });
});
