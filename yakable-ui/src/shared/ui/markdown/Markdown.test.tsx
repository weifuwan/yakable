import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Markdown } from './Markdown';

describe('Markdown', () => {
  it('renders common markdown syntax', () => {
    render(
      <Markdown
        content={[
          '## HashMap',
          '',
          '**Important**',
          '',
          '- key',
          '- value',
          '',
          '`hashCode()`',
          '',
          '[OpenAI](https://openai.com)',
          '',
          '| Key | Value |',
          '| --- | --- |',
          '| a | 1 |',
        ].join('\n')}
      />,
    );

    expect(screen.getByRole('heading', { name: 'HashMap' })).toBeTruthy();
    expect(screen.getByText('Important').tagName).toBe('STRONG');
    expect(screen.getByText('hashCode()').tagName).toBe('CODE');
    expect(screen.getByRole('link', { name: 'OpenAI' }).getAttribute('href')).toBe(
      'https://openai.com',
    );
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('renders incomplete streaming markdown without exposing syntax markers', () => {
    render(<Markdown content="**streaming" />);
    expect(screen.getByText('streaming')).toBeTruthy();
    expect(screen.queryByText('**streaming')).toBeNull();
  });
});
