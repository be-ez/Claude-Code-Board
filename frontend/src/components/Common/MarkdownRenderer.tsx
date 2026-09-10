import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { cn } from '../../utils';
import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  return (
    <div className={cn('markdown-body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={{
          // 自訂程式碼區塊
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            // A fenced block without a language has no `language-*` class, so a
            // class check alone mistakes it for inline code and gives a whole
            // code block the tiny inline pill styling. Multi-line content is a
            // block regardless of whether a language was declared.
            const isBlock = Boolean(match) || String(children).includes('\n');

            if (isBlock) {
              return (
                <div className="relative group">
                  {match && (
                    <div className="absolute top-2 right-2 text-xs text-gray-400 uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">
                      {match[1]}
                    </div>
                  )}
                  <code className={cn('block', className)} {...props}>
                    {children}
                  </code>
                </div>
              );
            }

            return (
              <code className={cn('markdown-inline-code', className)} {...props}>
                {children}
              </code>
            );
        },
        // 自訂連結
        a({ node, children, ...props }: any) {
          return (
            <a
              className="text-blue-600 hover:text-blue-800 underline"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            >
              {children}
            </a>
          );
        },
        // 自訂表格
        table({ node, children, ...props }: any) {
          return (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-gray-300" {...props}>
                {children}
              </table>
            </div>
          );
        },
        th({ node, children, ...props }: any) {
          return (
            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider bg-gray-50" {...props}>
              {children}
            </th>
          );
        },
        td({ node, children, ...props }: any) {
          return (
            <td className="px-3 py-2 text-sm text-gray-900 border-t border-gray-200" {...props}>
              {children}
            </td>
          );
        },
        // 自訂引用區塊
        blockquote({ node, children, ...props }: any) {
          return (
            <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 italic text-gray-700 bg-blue-50 rounded-r-lg" {...props}>
              {children}
            </blockquote>
          );
        },
        // 自訂圖片
        img({ node, ...props }: any) {
          return (
            <img
              className="max-w-full h-auto rounded-lg shadow-md my-4"
              loading="lazy"
              {...props}
            />
          );
        },
        // 自訂清單
        ul({ node, children, ...props }: any) {
          return (
            <ul className="list-disc list-inside space-y-1 my-3 pl-4" {...props}>
              {children}
            </ul>
          );
        },
        ol({ node, children, ...props }: any) {
          return (
            <ol className="list-decimal list-inside space-y-1 my-3 pl-4" {...props}>
              {children}
            </ol>
          );
        },
        // 自訂標題
        h1({ node, children, ...props }: any) {
          return (
            <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-4" {...props}>
              {children}
            </h1>
          );
        },
        h2({ node, children, ...props }: any) {
          return (
            <h2 className="text-xl font-bold text-gray-900 mt-5 mb-3" {...props}>
              {children}
            </h2>
          );
        },
        h3({ node, children, ...props }: any) {
          return (
            <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2" {...props}>
              {children}
            </h3>
          );
        },
        h4({ node, children, ...props }: any) {
          return (
            <h4 className="text-base font-semibold text-gray-900 mt-3 mb-2" {...props}>
              {children}
            </h4>
          );
        },
        // 自訂段落
        p({ node, children, ...props }: any) {
          return (
            <p className="my-3 leading-relaxed text-gray-800" {...props}>
              {children}
            </p>
          );
        },
        // 自訂水平線
        hr({ node, ...props }: any) {
          return <hr className="my-6 border-gray-300" {...props} />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
};