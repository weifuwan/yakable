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

  it('disables code actions while Assistant content is streaming', async () => {
    render(<Markdown content={javaMarkdown} mode="streaming" />);

    const copyButton = await screen.findByRole('button', { name: 'Copy Code' });
    const downloadButton = screen.getByRole('button', { name: 'Download file' });

    expect((copyButton as HTMLButtonElement).disabled).toBe(true);
    expect((downloadButton as HTMLButtonElement).disabled).toBe(true);
  });
});
