import type { ThreadMessageLike } from '@assistant-ui/react';
import type { ReadonlyJSONObject } from 'assistant-stream/utils';
import type { Message } from '../types/session.types';

/**
 * The board stores a flat stream of rows — a tool call here, its output three
 * rows later, thinking in between. assistant-ui models a turn as one assistant
 * message made of parts, with each tool call carrying its own result.
 *
 * This walks the flat stream and rebuilds those turns: every run of non-user
 * rows collapses into a single assistant message, and each `output` row is
 * attached to the tool call it belongs to (by `toolId`, falling back to the
 * most recent unanswered call in the same turn).
 */

type ToolCallPart = {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: ReadonlyJSONObject;
  argsText?: string;
  result?: unknown;
  isError?: boolean;
};

type TextPart = { type: 'text'; text: string };
type ReasoningPart = { type: 'reasoning'; text: string };
type AssistantPart = TextPart | ReasoningPart | ToolCallPart;

const parseArgs = (raw: unknown): { args: ReadonlyJSONObject; argsText?: string } => {
  if (raw && typeof raw === 'object') {
    return { args: raw as ReadonlyJSONObject };
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { args: parsed as ReadonlyJSONObject };
      }
    } catch {
      // Not JSON: keep the text so the tool UI can still show something.
    }
    return { args: {}, argsText: raw };
  }
  return { args: {} };
};

const timeOf = (message: Message): number => {
  const value = message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);
  const ms = value.getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

export const toThreadMessages = (messages: Message[]): ThreadMessageLike[] => {
  const thread: ThreadMessageLike[] = [];

  // The assistant turn currently being assembled.
  let parts: AssistantPart[] = [];
  let turnId = '';
  let turnAt = new Date();
  /** Tool calls in this turn that have not yet received their output. */
  let pendingCalls: ToolCallPart[] = [];

  const flushTurn = () => {
    if (parts.length === 0) return;
    thread.push({
      role: 'assistant',
      id: turnId,
      createdAt: turnAt,
      content: parts,
    });
    parts = [];
    pendingCalls = [];
  };

  const startTurn = (message: Message) => {
    if (parts.length === 0) {
      turnId = message.messageId;
      turnAt = message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);
    }
  };

  for (const message of [...messages].sort((a, b) => timeOf(a) - timeOf(b))) {
    switch (message.type) {
      case 'user': {
        flushTurn();
        thread.push({
          role: 'user',
          id: message.messageId,
          createdAt:
            message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp),
          content: [{ type: 'text', text: message.content }],
        });
        break;
      }

      case 'assistant':
      case 'claude': {
        if (!message.content.trim()) break;
        startTurn(message);
        parts.push({ type: 'text', text: message.content });
        break;
      }

      case 'thinking': {
        if (!message.content.trim()) break;
        startTurn(message);
        parts.push({ type: 'reasoning', text: message.content });
        break;
      }

      case 'tool_use': {
        startTurn(message);
        const source = message.metadata?.toolInput ?? message.content;
        const { args, argsText } = parseArgs(source);
        const call: ToolCallPart = {
          type: 'tool-call',
          toolCallId: message.metadata?.toolId ?? message.metadata?.toolUseId ?? message.messageId,
          toolName: message.metadata?.toolName ?? 'tool',
          args,
          ...(argsText ? { argsText } : {}),
        };
        parts.push(call);
        pendingCalls.push(call);
        break;
      }

      case 'output': {
        const toolId = message.metadata?.toolId ?? message.metadata?.toolUseId;
        const target = toolId
          ? pendingCalls.find((call) => call.toolCallId === toolId)
          : pendingCalls[pendingCalls.length - 1];

        if (target) {
          target.result = message.content;
          if (message.metadata?.isError) target.isError = true;
          pendingCalls = pendingCalls.filter((call) => call !== target);
          break;
        }

        // Raw stdout with no owning call: keep it visible as its own part.
        startTurn(message);
        parts.push({
          type: 'tool-call',
          toolCallId: message.messageId,
          toolName: 'output',
          args: {},
          result: message.content,
        });
        break;
      }

      case 'error': {
        startTurn(message);
        parts.push({
          type: 'tool-call',
          toolCallId: message.messageId,
          toolName: 'error',
          args: {},
          result: message.content,
          isError: true,
        });
        break;
      }

      case 'system': {
        flushTurn();
        thread.push({
          role: 'system',
          id: message.messageId,
          content: [{ type: 'text', text: message.content }],
        });
        break;
      }

      default:
        break;
    }
  }

  flushTurn();
  return thread;
};
