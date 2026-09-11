import React from 'react';
import { makeAssistantToolUI } from '@assistant-ui/react';
import { diffLines } from 'diff';
import {
  AlertCircle, Code, Edit as EditIcon, Eye, FileText, Globe,
  Search, Terminal, CheckCircle,
} from 'lucide-react';
import { AnsiOutput } from '../../Common/AnsiOutput';
import { MarkdownRenderer } from '../../Common/MarkdownRenderer';
import { ToolRow } from './ToolRow';

type Args = Record<string, any>;

const asText = (result: unknown): string => {
  if (typeof result === 'string') return result;
  if (result === undefined || result === null) return '';
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
};

/** Result rendered as terminal output, ANSI colours and all. */
const Result: React.FC<{ result: unknown }> = ({ result }) => {
  const text = asText(result);
  return text ? <AnsiOutput content={text} collapseAfterLines={20} /> : null;
};

const basename = (value: unknown): string => String(value ?? '').split('/').pop() || String(value ?? '');

/** Prefer the model's own description of the call; fall back to the payload. */
const labelFor = (args: Args, fallback: string): string =>
  (typeof args?.description === 'string' && args.description.trim()) || fallback;

/** A red/green line diff of an edit's before -> after. */
const Diff: React.FC<{ before: string; after: string }> = ({ before, after }) => {
  const parts = React.useMemo(() => diffLines(before, after), [before, after]);
  return (
    <pre className="text-xs rounded-lg overflow-x-auto border border-gray-200 font-mono leading-relaxed bg-white">
      <code>
        {parts.map((part, index) =>
          part.value
            .replace(/\n$/, '')
            .split('\n')
            .map((line, lineIndex) => (
              <div
                key={`${index}-${lineIndex}`}
                className={`px-2 whitespace-pre ${
                  part.added
                    ? 'bg-green-50 text-green-800'
                    : part.removed
                      ? 'bg-red-50 text-red-800'
                      : 'text-gray-600'
                }`}
              >
                <span className="select-none opacity-60 mr-2">
                  {part.added ? '+' : part.removed ? '-' : ' '}
                </span>
                {line}
              </div>
            ))
        )}
      </code>
    </pre>
  );
};

const Command: React.FC<{ command: string }> = ({ command }) => (
  <pre className="text-xs bg-slate-900 text-slate-100 p-2.5 rounded-lg overflow-x-auto font-mono">
    <code>
      <span className="text-green-400 select-none mr-2">$</span>
      {command}
    </code>
  </pre>
);

export const BashToolUI = makeAssistantToolUI<Args, unknown>({
  toolName: 'Bash',
  render: ({ args, result, status }) => (
    <ToolRow
      icon={Terminal}
      label={labelFor(args, args?.command ?? 'Bash')}
      isRunning={status?.type === 'running'}
      detail={args?.command ? <Command command={String(args.command)} /> : undefined}
      result={<Result result={result} />}
    />
  ),
});

const EditRender: React.FC<{ args: Args; result: unknown; running?: boolean }> = ({
  args, result, running,
}) => {
  const edits: { old_string?: string; new_string?: string }[] = Array.isArray(args?.edits)
    ? args.edits
    : [{ old_string: args?.old_string, new_string: args?.new_string }];
  return (
    <ToolRow
      icon={EditIcon}
      label={labelFor(args, `Edit ${basename(args?.file_path)}`)}
      isRunning={running}
      detail={
        <div className="space-y-1.5">
          {args?.file_path && (
            <div className="text-xs font-mono text-gray-500 break-all">{String(args.file_path)}</div>
          )}
          {edits.map((edit, index) => (
            <Diff key={index} before={edit.old_string ?? ''} after={edit.new_string ?? ''} />
          ))}
        </div>
      }
      result={<Result result={result} />}
    />
  );
};

export const EditToolUI = makeAssistantToolUI<Args, unknown>({
  toolName: 'Edit',
  render: ({ args, result, status }) => (
    <EditRender args={args} result={result} running={status?.type === 'running'} />
  ),
});

export const MultiEditToolUI = makeAssistantToolUI<Args, unknown>({
  toolName: 'MultiEdit',
  render: ({ args, result, status }) => (
    <EditRender args={args} result={result} running={status?.type === 'running'} />
  ),
});

export const WriteToolUI = makeAssistantToolUI<Args, unknown>({
  toolName: 'Write',
  render: ({ args, result, status }) => {
    const ext = String(args?.file_path ?? '').split('.').pop() ?? '';
    return (
      <ToolRow
        icon={FileText}
        label={labelFor(args, `Write ${basename(args?.file_path)}`)}
        isRunning={status?.type === 'running'}
        detail={
          <div className="space-y-1.5">
            {args?.file_path && (
              <div className="text-xs font-mono text-gray-500 break-all">{String(args.file_path)}</div>
            )}
            {typeof args?.content === 'string' && (
              <MarkdownRenderer content={'```' + ext + '\n' + args.content + '\n```'} />
            )}
          </div>
        }
        result={<Result result={result} />}
      />
    );
  },
});

const makeSimpleToolUI = (toolName: string, icon: typeof Eye, summaryKey: string) =>
  makeAssistantToolUI<Args, unknown>({
    toolName,
    render: ({ args, result, status }) => {
      const value = args?.[summaryKey];
      const fallback = value ? `${toolName} ${basename(value)}` : toolName;
      return (
        <ToolRow
          icon={icon}
          label={labelFor(args, fallback)}
          isRunning={status?.type === 'running'}
          detail={
            value ? (
              <div className="text-xs font-mono text-gray-500 break-all">
                {typeof value === 'string' ? value : JSON.stringify(value)}
              </div>
            ) : undefined
          }
          result={<Result result={result} />}
        />
      );
    },
  });

export const ReadToolUI = makeSimpleToolUI('Read', Eye, 'file_path');
export const GrepToolUI = makeSimpleToolUI('Grep', Search, 'pattern');
export const GlobToolUI = makeSimpleToolUI('Glob', Search, 'pattern');
export const WebSearchToolUI = makeSimpleToolUI('WebSearch', Globe, 'query');
export const WebFetchToolUI = makeSimpleToolUI('WebFetch', Globe, 'url');
export const TodoWriteToolUI = makeSimpleToolUI('TodoWrite', CheckCircle, 'todos');

/** Raw stdout that never belonged to a tool call. */
export const RawOutputToolUI = makeAssistantToolUI<Args, unknown>({
  toolName: 'output',
  render: ({ result }) => <Result result={result} />,
});

export const ErrorToolUI = makeAssistantToolUI<Args, unknown>({
  toolName: 'error',
  render: ({ result }) => (
    <ToolRow icon={AlertCircle} label={asText(result).split('\n')[0]} isError result={<Result result={result} />} />
  ),
});

/** Anything Claude Code calls that has no bespoke row above. */
export const FallbackToolUI: React.FC<{
  toolName: string;
  args: Args;
  result: unknown;
  isRunning?: boolean;
}> = ({ toolName, args, result, isRunning }) => {
  const entries = Object.entries(args ?? {}).filter(([, v]) => v !== undefined && v !== '');
  return (
    <ToolRow
      icon={Code}
      label={labelFor(args, toolName)}
      isRunning={isRunning}
      detail={
        entries.length > 0 ? (
          <dl className="text-xs space-y-1">
            {entries.slice(0, 8).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <dt className="text-gray-500 flex-shrink-0">{key}</dt>
                <dd className="text-gray-800 font-mono truncate min-w-0">
                  {typeof value === 'string' ? value : JSON.stringify(value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : undefined
      }
      result={<Result result={result} />}
    />
  );
};

/** Mount every registered tool UI once, near the thread root. */
export const ToolUIs: React.FC = () => (
  <>
    <BashToolUI />
    <EditToolUI />
    <MultiEditToolUI />
    <WriteToolUI />
    <ReadToolUI />
    <GrepToolUI />
    <GlobToolUI />
    <WebSearchToolUI />
    <WebFetchToolUI />
    <TodoWriteToolUI />
    <RawOutputToolUI />
    <ErrorToolUI />
  </>
);
