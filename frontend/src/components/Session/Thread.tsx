import React from 'react';
import {
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  type TextMessagePartComponent,
  type ReasoningMessagePartComponent,
  type ToolCallMessagePartProps,
} from '@assistant-ui/react';
import { Bot, Brain, ChevronDown, ChevronRight, Send, User, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MarkdownRenderer } from '../Common/MarkdownRenderer';
import { FallbackToolUI, ToolUIs } from './tools';

/** Assistant prose. */
const TextPart: TextMessagePartComponent = ({ text }) => (
  <div className="text-sm">
    <MarkdownRenderer content={text} />
  </div>
);

/** Thinking, folded away by default. */
const ReasoningPart: ReasoningMessagePartComponent = ({ text }) => {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  if (!text?.trim()) return null;
  return (
    <div className="my-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-purple-700 hover:underline"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Brain className="w-3 h-3" />
        {t('messageItem.showThinking')}
      </button>
      {open && (
        <div className="mt-1.5 p-2 bg-purple-50 rounded-lg border border-purple-200">
          <div className="text-xs text-purple-700 whitespace-pre-wrap font-mono leading-relaxed">
            {text}
          </div>
        </div>
      )}
    </div>
  );
};

/** Any tool Claude Code called that has no bespoke card. */
const ToolFallback: React.FC<ToolCallMessagePartProps> = ({ toolName, args, result, status }) => (
  <FallbackToolUI
    toolName={toolName}
    args={args as Record<string, any>}
    result={result}
    isRunning={status?.type === 'running'}
  />
);

/**
 * Groups each run of consecutive tool calls into one collapsible block, so a
 * turn reads as "Ran 3 commands" rather than three stacked cards. Text and
 * reasoning parts stay ungrouped (key `undefined` renders them bare).
 *
 * The group's summary is encoded into the key — `tools:bash:3` — because the
 * Group component only receives the key and the indices, not the parts.
 */
const KIND_BY_TOOL: Record<string, string> = {
  Bash: 'bash',
  Read: 'read',
  Edit: 'edit',
  MultiEdit: 'edit',
  Write: 'edit',
  Grep: 'search',
  Glob: 'search',
  WebSearch: 'web',
  WebFetch: 'web',
};

const groupConsecutiveToolCalls = (parts: readonly any[]) => {
  const groups: { groupKey: string | undefined; indices: number[] }[] = [];
  let run: number[] = [];

  const flush = () => {
    if (run.length === 0) return;
    // A lone call needs no wrapper — it is already one line.
    if (run.length === 1) {
      groups.push({ groupKey: undefined, indices: run });
      run = [];
      return;
    }
    const kinds = new Set(run.map((i) => KIND_BY_TOOL[parts[i]?.toolName] ?? 'other'));
    const kind = kinds.size === 1 ? [...kinds][0] : 'mixed';
    groups.push({ groupKey: `tools:${kind}:${run.length}`, indices: run });
    run = [];
  };

  parts.forEach((part, index) => {
    // Raw stdout and errors render on their own, never inside a group.
    const isGroupable =
      part?.type === 'tool-call' && part.toolName !== 'output' && part.toolName !== 'error';
    if (isGroupable) {
      run.push(index);
    } else {
      flush();
      groups.push({ groupKey: undefined, indices: [index] });
    }
  });
  flush();

  return groups;
};

/** The collapsed "Ran 3 commands" line, expanding into the individual rows. */
const ToolGroup: React.FC<React.PropsWithChildren<{ groupKey: string | undefined }>> = ({
  groupKey,
  children,
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);

  if (!groupKey?.startsWith('tools:')) return <>{children}</>;

  const [, kind, rawCount] = groupKey.split(':');
  const count = Number(rawCount) || 0;

  return (
    <div className="my-1.5 rounded-lg border border-gray-200 bg-white/60 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-gray-50/80 hover:bg-gray-100/80 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
        )}
        <Wrench className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        <span className="text-xs font-medium text-gray-700">
          {t(`toolGroup.${kind}`, { count })}
        </span>
      </button>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  );
};

/** The user's own text, rendered as markdown so pasted commands read as code. */
const UserTextPart: TextMessagePartComponent = ({ text }) => (
  <div className="text-sm text-left">
    <MarkdownRenderer content={text} />
  </div>
);

const UserMessage: React.FC = () => (
  <MessagePrimitive.Root className="mb-2 pl-6 user-message">
    <div className="px-3 py-2 rounded-lg glass-card shadow-soft bg-gradient-to-br from-primary-500 to-primary-600 text-white">
      <div className="flex items-start gap-2 justify-end">
        <div className="max-w-[85%] text-white break-words text-sm leading-relaxed min-w-0">
          <MessagePrimitive.Parts components={{ Text: UserTextPart }} />
        </div>
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md ring-2 ring-white/30">
          <User className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  </MessagePrimitive.Root>
);

const AssistantMessage: React.FC = () => (
  <MessagePrimitive.Root className="mb-2 pr-6">
    <div className="px-3 py-2 rounded-lg glass-card shadow-soft bg-white border border-gray-100 group">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white shadow-md ring-2 ring-white/30">
          <Bot className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0 overflow-hidden text-gray-800">
          <div className="font-medium text-xs text-gray-900 mb-1">Claude</div>
          <MessagePrimitive.Unstable_PartsGrouped
            groupingFunction={groupConsecutiveToolCalls}
            components={{
              Text: TextPart,
              Reasoning: ReasoningPart,
              tools: { Fallback: ToolFallback },
              Group: ToolGroup,
            }}
          />
        </div>
      </div>
    </div>
  </MessagePrimitive.Root>
);

const SystemMessage: React.FC = () => (
  <MessagePrimitive.Root className="mb-2">
    <div className="px-3 py-2 rounded-lg text-xs bg-warning-50 border border-warning-200 text-warning-900">
      <MessagePrimitive.Parts components={{ Text: TextPart }} />
    </div>
  </MessagePrimitive.Root>
);

const Composer: React.FC<{ disabled: boolean; placeholder: string }> = ({
  disabled,
  placeholder,
}) => (
  <ComposerPrimitive.Root className="border-t border-glass-border glass p-3">
    <div className="flex items-end gap-2">
      <ComposerPrimitive.Input
        autoFocus
        disabled={disabled}
        placeholder={placeholder}
        rows={1}
        className="flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-400 max-h-40"
      />
      <ComposerPrimitive.Send
        disabled={disabled}
        className="flex-shrink-0 rounded-lg bg-primary-600 p-2 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Send className="w-4 h-4" />
      </ComposerPrimitive.Send>
    </div>
  </ComposerPrimitive.Root>
);

interface ThreadProps {
  isSessionActive: boolean;
  /** Rendered above the message list — the filter bar, load-older button, etc. */
  header?: React.ReactNode;
  beforeMessages?: React.ReactNode;
  empty?: React.ReactNode;
  onViewportRef?: (element: HTMLDivElement | null) => void;
}

export const Thread: React.FC<ThreadProps> = ({
  isSessionActive,
  header,
  beforeMessages,
  empty,
  onViewportRef,
}) => {
  const { t } = useTranslation();

  return (
    <ThreadPrimitive.Root className="flex flex-col h-full">
      {/* Tool renderers register themselves once, for the whole thread. */}
      <ToolUIs />

      {header}

      <ThreadPrimitive.Viewport
        ref={onViewportRef}
        className="flex-1 overflow-y-auto bg-gradient-soft px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6"
      >
        {beforeMessages}

        <ThreadPrimitive.Empty>{empty}</ThreadPrimitive.Empty>

        <ThreadPrimitive.Messages
          components={{
            Message: AssistantMessage,
            UserMessage,
            AssistantMessage,
            SystemMessage,
          }}
        />

        <ThreadPrimitive.If running>
          <div className="flex items-center gap-1 px-3 py-2">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="w-2 h-2 bg-green-500 rounded-full animate-bounce"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </div>
        </ThreadPrimitive.If>
      </ThreadPrimitive.Viewport>

      <Composer
        disabled={!isSessionActive}
        placeholder={isSessionActive ? t('chat.inputPlaceholder') : t('chat.sessionStopped')}
      />
    </ThreadPrimitive.Root>
  );
};
