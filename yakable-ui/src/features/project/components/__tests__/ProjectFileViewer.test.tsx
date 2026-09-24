import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProjectFileViewer } from '../ProjectFileViewer';

describe('ProjectFileViewer', () => {
  it('asks the user to select a file before loading content', () => {
    render(<ProjectFileViewer selectedPath={null} file={null} loading={false} error={null} />);

    expect(screen.getByText('Select a file to view its contents.')).toBeTruthy();
  });

  it('renders the selected source file through the shared code renderer', async () => {
    const content = ['const answer = 42;', 'export default answer;'].join('\n');
    const { container } = render(
      <ProjectFileViewer
        selectedPath="src/App.tsx"
        file={{ path: 'src/App.tsx', content }}
        loading={false}
        error={null}
      />,
    );

    expect(await screen.findByText('tsx')).toBeTruthy();
    const codeBlock = container.querySelector('[data-streamdown="code-block"]');
    expect(codeBlock?.textContent).toContain('const answer');
    expect(codeBlock?.textContent).toContain('export default answer');
  });

  it('keeps one file read failure local to the viewer', () => {
    render(
      <ProjectFileViewer
        selectedPath="src/App.tsx"
        file={null}
        loading={false}
        error="Resource not found"
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('Resource not found');
  });
});
