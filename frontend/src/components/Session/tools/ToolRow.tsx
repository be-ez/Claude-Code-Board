import React, { useState } from 'react';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '../../../utils';

interface ToolRowProps {
  icon: LucideIcon;
  /** The one-line label: the call's description, or a file path / pattern. */
  label: React.ReactNode;
  /** What the call actually was — the command, the diff, the file contents. */
  detail?: React.ReactNode;
  /** What came back. */
  result?: React.ReactNode;
  isError?: boolean;
  isRunning?: boolean;
}

/**
 * One tool call as a single collapsed line. Expanding reveals the call itself
 * and its output, so a run of twenty calls reads as twenty scannable lines
 * rather than twenty walls of text.
 */
export const ToolRow: React.FC<ToolRowProps> = ({
  icon: Icon,
  label,
  detail,
  result,
  isError,
  isRunning,
}) => {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(detail || result);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => expandable && setOpen(!open)}
        disabled={!expandable}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors',
          expandable && 'hover:bg-gray-50 cursor-pointer'
        )}
      >
        {expandable ? (
          open ? (
            <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
          )
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <Icon
          className={cn('w-3.5 h-3.5 flex-shrink-0', isError ? 'text-danger-500' : 'text-gray-400')}
        />
        <span
          className={cn(
            'text-xs truncate',
            isError ? 'text-danger-700' : 'text-gray-600'
          )}
        >
          {label}
        </span>
        {isRunning && (
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-2 pb-2 pl-7 space-y-1.5">
          {detail}
          {result}
        </div>
      )}
    </div>
  );
};
