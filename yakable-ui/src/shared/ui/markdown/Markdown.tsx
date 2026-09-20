import { memo } from 'react';
import { Streamdown } from 'streamdown';

import { cx } from '../cx';

export interface MarkdownProps {
  content: string;
  className?: string;
}

/**
 * Yakable 统一 Markdown Renderer。
 */
export const Markdown = memo(({ content, className }: MarkdownProps) => (
  <Streamdown
    className={cx(
      'min-w-0 text-[15px] leading-7 text-[#20201e]',
      '[&_p]:my-0 [&_p+p]:mt-3',
      '[&_h1]:mb-3 [&_h1]:mt-5 [&_h1]:text-xl [&_h1]:font-semibold',
      '[&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold',
      '[&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold',
      '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6',
      '[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6',
      '[&_li]:my-1',
      '[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-black/15 [&_blockquote]:pl-4 [&_blockquote]:text-black/60',
      '[&_code]:rounded-md [&_code]:bg-black/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]',
      '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-black/[0.05] [&_pre]:p-4',
      '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
      '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm',
      '[&_th]:border [&_th]:border-black/10 [&_th]:bg-black/[0.03] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium',
      '[&_td]:border [&_td]:border-black/10 [&_td]:px-3 [&_td]:py-2',
      '[&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2',
      className,
    )}
  >
    {content}
  </Streamdown>
));

Markdown.displayName = 'Markdown';
