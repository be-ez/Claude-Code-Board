import React, { useMemo, useState } from 'react';
import Anser from 'anser';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AnsiOutputProps {
  content: string;
  /** Lines shown before the block is collapsed behind a "show more" toggle. */
  collapseAfterLines?: number;
}

/** Anser's 8/16 colour names mapped onto the palette used elsewhere in the app. */
const FG_COLORS: Record<string, string> = {
  'ansi-black': '#4b5563',
  'ansi-red': '#dc2626',
  'ansi-green': '#16a34a',
  'ansi-yellow': '#ca8a04',
  'ansi-blue': '#2563eb',
  'ansi-magenta': '#c026d3',
  'ansi-cyan': '#0891b2',
  'ansi-white': '#e5e7eb',
  'ansi-bright-black': '#6b7280',
  'ansi-bright-red': '#ef4444',
  'ansi-bright-green': '#22c55e',
  'ansi-bright-yellow': '#eab308',
  'ansi-bright-blue': '#3b82f6',
  'ansi-bright-magenta': '#d946ef',
  'ansi-bright-cyan': '#06b6d4',
  'ansi-bright-white': '#f9fafb',
};

const colorOf = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  // Anser gives either a palette name or an "r, g, b" triple.
  if (FG_COLORS[value]) return FG_COLORS[value];
  return /^\d+,\s*\d+,\s*\d+$/.test(value) ? `rgb(${value})` : undefined;
};

/**
 * Terminal output rendered the way a terminal would: ANSI colour escapes become
 * real colours instead of literal "[32m" noise, and long dumps collapse.
 */
export const AnsiOutput: React.FC<AnsiOutputProps> = ({ content, collapseAfterLines = 20 }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const lines = useMemo(() => content.replace(/\n$/, '').split('\n'), [content]);
  const isLong = lines.length > collapseAfterLines;
  const visible = expanded || !isLong ? lines : lines.slice(0, collapseAfterLines);

  const parsed = useMemo(
    () =>
      visible.map((line) =>
        Anser.ansiToJson(line, { use_classes: true, remove_empty: true })
      ),
    [visible]
  );

  return (
    <div className="mt-1.5">
      <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto border border-gray-800 shadow-inner font-mono leading-relaxed">
        <code>
          {parsed.map((chunks, lineIndex) => (
            <div key={lineIndex} className="whitespace-pre">
              {chunks.map((chunk, chunkIndex) => {
                const color = colorOf(chunk.fg);
                const background = colorOf(chunk.bg);
                const decorations = chunk.decorations ?? [];
                return (
                  <span
                    key={chunkIndex}
                    style={{
                      color,
                      background,
                      fontWeight: decorations.includes('bold') ? 600 : undefined,
                      fontStyle: decorations.includes('italic') ? 'italic' : undefined,
                      textDecoration: decorations.includes('underline') ? 'underline' : undefined,
                      opacity: decorations.includes('dim') ? 0.7 : undefined,
                    }}
                  >
                    {chunk.content}
                  </span>
                );
              })}
              {chunks.length === 0 ? ' ' : null}
            </div>
          ))}
        </code>
      </pre>

      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 mt-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span>
            {expanded
              ? t('messageItem.collapseOutput')
              : t('messageItem.expandOutput', { count: lines.length - collapseAfterLines })}
          </span>
        </button>
      )}
    </div>
  );
};
