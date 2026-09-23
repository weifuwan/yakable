import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Markdown } from '../Markdown';

const javaCode = ['class Hello {', '  int value = 1;', '}'].join('\n') + '\n';
const javaMarkdown = '```java\n' + javaCode + '```';

describe('Markdown', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      writable: true,
      value: originalClipboard,
    });
  });

  it('renders fenced code with generic language-aware controls', async () => {
    const { container } = render(<Markdown content={javaMarkdown} />);

    expect(await screen.findByText('java')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy Code' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Download file' })).toBeTruthy();

    const codeBlock = container.querySelector('[data-streamdown="code-block"]');
    expect(codeBlock?.textContent).toContain('class Hello');
  });

  it('copies the raw fenced code text', async () => {
    render(<Markdown content={javaMarkdown} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Copy Code' }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(javaCode);
    });
  });

  it('falls back to readable plain code for an unknown fenced language', async () => {
    const content = ['```yakable-unknown', 'some unknown syntax', '```'].join('\n');
    const { container } = render(<Markdown content={content} />);

    expect(await screen.findByText('yakable-unknown')).toBeTruthy();

    const codeBlock = container.querySelector('[data-streamdown="code-block"]');
    expect(codeBlock?.textContent).toContain('some unknown syntax');
    expect(screen.getByRole('button', { name: 'Copy Code' })).toBeTruthy();
  });

  it('keeps an incomplete fenced code block visible while streaming', async () => {
    const content = ['```typescript', 'const answer = 42;'].join('\n');
    const { container } = render(<Markdown content={content} mode="streaming" />);

    expect(await screen.findByText('typescript')).toBeTruthy();

    const codeBlock = container.querySelector('[data-streamdown="code-block"]');
    expect(codeBlock?.textContent).toContain('const answer = 42;');
    expect((screen.getByRole('button', { name: 'Copy Code' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('sanitizes dangerous raw HTML and URL attributes', () => {
    const content = [
      '<script>window.yakableXss = true</script>',
      '<a href="javascript:alert(1)" onclick="alert(1)">unsafe link</a>',
      '<strong>safe text</strong>',
    ].join('\n');

    const { container } = render(<Markdown content={content} />);

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();

    expect(container.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(container.textContent).toContain('unsafe link');
    expect(screen.getByText('safe text')).toBeTruthy();
  });

  it('renders script-looking fenced code as text instead of executable HTML', async () => {
    const source = '<script>alert("xss")</script>';
    const content = ['```html', source, '```'].join('\n');
    const { container } = render(<Markdown content={content} />);

    await screen.findByText('html');

    const codeBlock = container.querySelector('[data-streamdown="code-block"]');
    expect(codeBlock?.querySelector('script')).toBeNull();
    expect(codeBlock?.textContent).toContain(source);
  });

  it('disables code actions while Assistant content is streaming', async () => {
    render(<Markdown content={javaMarkdown} mode="streaming" />);

    const copyButton = await screen.findByRole('button', { name: 'Copy Code' });
    const downloadButton = screen.getByRole('button', { name: 'Download file' });

    expect((copyButton as HTMLButtonElement).disabled).toBe(true);
    expect((downloadButton as HTMLButtonElement).disabled).toBe(true);
  });
});
