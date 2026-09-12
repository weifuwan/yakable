import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { instrumentPreviewSource } from '../src/preview-source-metadata.js';

const projectRoot = path.resolve('/tmp/yakable-preview-source-project');
const heroPath = path.join(projectRoot, 'src', 'components', 'Hero.tsx');

const heroSource = `export function Hero() {
  return (
    <section className="hero">
      <h1>Build something great</h1>
      <button type="button">Start</button>
      <Card />
    </section>
  );
}
`;

test('annotates intrinsic JSX elements with stable project-relative source metadata', () => {
  const first = instrumentPreviewSource(heroSource, heroPath, projectRoot);
  const second = instrumentPreviewSource(heroSource, heroPath, projectRoot);

  assert.ok(first);
  assert.equal(first, second);
  assert.match(first, /<section data-yakable-source-id="yak_[a-f0-9]{12}"/);
  assert.match(first, /data-yakable-source="src\/components\/Hero\.tsx:3:5"/);
  assert.match(first, /data-yakable-source-file="src\/components\/Hero\.tsx"/);
  assert.match(first, /data-yakable-source-line="4"/);
  assert.match(first, /data-yakable-source-column="7"/);
  assert.doesNotMatch(first, /<Card data-yakable-source-id=/);
});

test('skips files outside the project and non-JSX source files', () => {
  assert.equal(
    instrumentPreviewSource(heroSource, path.resolve('/tmp/outside/Hero.tsx'), projectRoot),
    null,
  );
  assert.equal(
    instrumentPreviewSource('export const answer = 42;', path.join(projectRoot, 'src/data.ts'), projectRoot),
    null,
  );
});
