import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { SessionRepository } from '../repositories/SessionRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { Session, SessionStatus } from '../types/session.types';
import { Message } from '../repositories/MessageRepository';
import { logger } from '../utils/logger';

/** One Claude Code transcript found on disk, as offered to the user for import. */
export interface DiscoveredClaudeSession {
  claudeSessionId: string;
  filePath: string;
  workingDir: string;
  title: string;
  messageCount: number;
  startedAt: string | null;
  lastActivityAt: string | null;
  sizeBytes: number;
  /** True when a board session already points at this transcript. */
  alreadyImported: boolean;
  importedSessionId?: string;
}

export interface SyncResult {
  added: number;
  status: 'synced' | 'up_to_date' | 'not_imported' | 'transcript_missing' | 'not_found';
}

export interface ImportResult {
  imported: { claudeSessionId: string; sessionId: string; name: string; messageCount: number }[];
  skipped: { claudeSessionId: string; reason: string }[];
}

type TranscriptLine = Record<string, any>;

/** A board message built from a transcript, before it gets its own id. */
type BuiltMessage = Omit<Message, 'messageId' | 'timestamp'> & { timestamp: Date };

/** Message types the board understands, mapped from transcript content blocks. */
type BoardMessageType = Message['type'];

export class ClaudeSessionImportService {
  private sessionRepo: SessionRepository;
  private messageRepo: MessageRepository;

  constructor(sessionRepo: SessionRepository, messageRepo: MessageRepository) {
    this.sessionRepo = sessionRepo;
    this.messageRepo = messageRepo;
  }

  /** Root of Claude Code's per-project transcript store. */
  getProjectsPath(): string {
    return process.env.CLAUDE_PROJECTS_PATH || path.join(os.homedir(), '.claude', 'projects');
  }

  /**
   * Scan every project directory for .jsonl transcripts and summarise each one.
   * Transcripts that are already on the board are still listed, but flagged so
   * the UI can grey them out instead of silently duplicating them.
   */
  async discover(): Promise<DiscoveredClaudeSession[]> {
    const root = this.getProjectsPath();
    let projectDirs: string[];
    try {
      const entries = await fsp.readdir(root, { withFileTypes: true });
      projectDirs = entries.filter((e) => e.isDirectory()).map((e) => path.join(root, e.name));
    } catch (error: any) {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }

    const existing = await this.getImportedIndex();
    const results: DiscoveredClaudeSession[] = [];

    for (const dir of projectDirs) {
      let files: string[];
      try {
        files = (await fsp.readdir(dir)).filter((f) => f.endsWith('.jsonl'));
      } catch {
        continue;
      }
      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const summary = await this.summarise(filePath);
          if (!summary) continue;
          const importedSessionId = existing.get(summary.claudeSessionId);
          results.push({
            ...summary,
            alreadyImported: Boolean(importedSessionId),
            importedSessionId,
          });
        } catch (error) {
          logger.warn(`Failed to read Claude transcript ${filePath}`, { error: String(error) });
        }
      }
    }

    // Newest conversation first — that is what people look for after a run.
    return results.sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? ''));
  }

  /** Map of claude session id -> board session id, for transcripts already imported. */
  private async getImportedIndex(): Promise<Map<string, string>> {
    const sessions = await this.sessionRepo.findAll(true);
    const map = new Map<string, string>();
    for (const s of sessions) {
      if (s.claudeSessionId) map.set(s.claudeSessionId, s.sessionId);
    }
    return map;
  }

  /** Read a transcript once, pulling out only what the picker needs to show. */
  private async summarise(
    filePath: string
  ): Promise<Omit<DiscoveredClaudeSession, 'alreadyImported' | 'importedSessionId'> | null> {
    const stat = await fsp.stat(filePath);
    let claudeSessionId = path.basename(filePath, '.jsonl');
    let workingDir = '';
    let aiTitle = '';
    let firstPrompt = '';
    let messageCount = 0;
    let startedAt: string | null = null;
    let lastActivityAt: string | null = null;

    await this.eachLine(filePath, (line) => {
      if (line.sessionId) claudeSessionId = line.sessionId;
      if (line.cwd && !workingDir) workingDir = line.cwd;
      if (line.type === 'ai-title' && line.aiTitle) aiTitle = line.aiTitle;

      if (line.type === 'user' || line.type === 'assistant') {
        messageCount++;
        if (line.timestamp) {
          if (!startedAt) startedAt = line.timestamp;
          lastActivityAt = line.timestamp;
        }
        if (line.type === 'user' && !firstPrompt) {
          const text = this.extractText(line.message?.content);
          if (text) firstPrompt = text;
        }
      }
    });

    if (messageCount === 0) return null;

    const title = aiTitle || this.truncate(firstPrompt, 80) || claudeSessionId;
    return {
      claudeSessionId,
      filePath,
      workingDir,
      title,
      messageCount,
      startedAt,
      lastActivityAt,
      sizeBytes: stat.size,
    };
  }

  /**
   * Import the given transcripts. Each becomes a completed board session with
   * its full message history; transcripts already imported are skipped rather
   * than duplicated.
   */
  async import(claudeSessionIds: string[]): Promise<ImportResult> {
    const available = await this.discover();
    const byId = new Map(available.map((s) => [s.claudeSessionId, s]));
    const result: ImportResult = { imported: [], skipped: [] };

    for (const id of claudeSessionIds) {
      const found = byId.get(id);
      if (!found) {
        result.skipped.push({ claudeSessionId: id, reason: 'not_found' });
        continue;
      }
      if (found.alreadyImported) {
        result.skipped.push({ claudeSessionId: id, reason: 'already_imported' });
        continue;
      }
      try {
        const imported = await this.importOne(found);
        result.imported.push(imported);
      } catch (error) {
        logger.error(`Failed to import Claude session ${id}`, { error: String(error) });
        result.skipped.push({ claudeSessionId: id, reason: 'import_failed' });
      }
    }

    return result;
  }

  /**
   * Read a transcript into board messages. Every message carries the uuid of
   * the transcript line it came from, which is what lets `sync` tell new
   * content from content already on the board.
   */
  private async buildMessages(
    found: DiscoveredClaudeSession,
    sessionId: string
  ): Promise<{
    messages: BuiltMessage[];
    lastUserMessage: string;
    userTurns: number;
    firstPrompt: string;
  }> {
    const lastActivity = found.lastActivityAt ? new Date(found.lastActivityAt) : new Date();
    const messages: BuiltMessage[] = [];
    let lastUserMessage = '';
    let userTurns = 0;
    let firstPrompt = '';

    await this.eachLine(found.filePath, (line) => {
      const sourceUuid: string | undefined = line.uuid;
      const timestamp = line.timestamp ? new Date(line.timestamp) : lastActivity;

      if (line.type === 'user') {
        const content = line.message?.content;
        const text = this.extractText(content);
        if (text) {
          if (!firstPrompt) firstPrompt = text;
          lastUserMessage = text;
          userTurns++;
          messages.push({ sessionId, type: 'user', content: text, timestamp, metadata: { imported: true, sourceUuid } });
        }
        // Tool results come back on user lines; keep them as output blocks.
        for (const block of this.blocks(content)) {
          if (block.type === 'tool_result') {
            const output = this.extractText(block.content);
            if (output) {
              messages.push({
                sessionId,
                type: 'output',
                content: output,
                timestamp,
                metadata: { toolUseId: block.tool_use_id, imported: true, sourceUuid },
              });
            }
          }
        }
        return;
      }

      if (line.type === 'assistant') {
        for (const block of this.blocks(line.message?.content)) {
          const mapped = this.mapBlock(block);
          if (!mapped) continue;
          messages.push({
            sessionId,
            type: mapped.type,
            content: mapped.content,
            timestamp,
            metadata: { ...mapped.metadata, imported: true, sourceUuid },
          });
        }
      }
    });

    return { messages, lastUserMessage, userTurns, firstPrompt };
  }

/**
   * Re-read an imported session's transcript and append anything that has been
   * added since. Claude Code keeps writing to the same .jsonl as a conversation
   * continues, so a session imported mid-run goes stale the moment it is saved.
   *
   * Messages are matched on the transcript line's own uuid, so re-syncing is
   * safe to run on every open — nothing gets duplicated.
   */
  async sync(sessionId: string): Promise<SyncResult> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) return { added: 0, status: 'not_found' };
    if (!session.claudeSessionId) return { added: 0, status: 'not_imported' };

    const found = (await this.discover()).find(
      (candidate) => candidate.claudeSessionId === session.claudeSessionId
    );
    if (!found) return { added: 0, status: 'transcript_missing' };

    const { messages, lastUserMessage, userTurns } = await this.buildMessages(found, sessionId);

    // Everything already on the board, by the transcript line it came from.
    const existing = await this.messageRepo.findBySessionId(sessionId, 1, Number.MAX_SAFE_INTEGER);
    const seen = new Set<string>();
    for (const message of existing.messages) {
      const uuid = (message.metadata as any)?.sourceUuid;
      if (uuid) seen.add(uuid);
    }

    // Sessions imported before uuids were recorded have rows that cannot be
    // matched by uuid. Everything up to the newest such row is taken as already
    // present; past that watermark, uuid matching does the work. Using either
    // rule alone re-imports that unmarked history on every sync.
    const watermark = existing.messages.reduce((latest, message) => {
      if ((message.metadata as any)?.sourceUuid) return latest;
      const time = new Date(message.timestamp).getTime();
      return Number.isNaN(time) ? latest : Math.max(latest, time);
    }, 0);

    const fresh = messages.filter((message) => {
      const uuid = (message.metadata as any)?.sourceUuid;
      if (uuid && seen.has(uuid)) return false;
      return message.timestamp.getTime() > watermark;
    });

    if (fresh.length === 0) return { added: 0, status: 'up_to_date' };

    for (const message of fresh) {
      await this.messageRepo.save(message);
    }

    const lastActivity = found.lastActivityAt ? new Date(found.lastActivityAt) : new Date();
    await this.sessionRepo.update({
      ...session,
      lastUserMessage: lastUserMessage || session.lastUserMessage,
      messageCount: userTurns || session.messageCount,
      updatedAt: lastActivity,
      completedAt: lastActivity,
    });

    logger.info(`Synced Claude session ${session.claudeSessionId}`, { added: fresh.length });
    return { added: fresh.length, status: 'synced' };
  }

  private async importOne(found: DiscoveredClaudeSession) {
    const sessionId = uuidv4();
    const startedAt = found.startedAt ? new Date(found.startedAt) : new Date();
    const lastActivity = found.lastActivityAt ? new Date(found.lastActivityAt) : startedAt;

    const { messages, lastUserMessage, userTurns, firstPrompt } = await this.buildMessages(
      found,
      sessionId
    );

    const session: Session = {
      sessionId,
      name: found.title,
      workingDir: found.workingDir || process.cwd(),
      task: firstPrompt || found.title,
      status: SessionStatus.COMPLETED,
      continueChat: false,
      claudeSessionId: found.claudeSessionId,
      lastUserMessage,
      messageCount: userTurns,
      createdAt: startedAt,
      updatedAt: lastActivity,
      completedAt: lastActivity,
    };

    await this.sessionRepo.save(session);
    try {
      for (const message of messages) {
        await this.messageRepo.save(message);
      }
    } catch (error) {
      // Leave nothing half-imported: a session whose history failed to load
      // would otherwise count as "already imported" and block a retry.
      await this.sessionRepo.delete(sessionId).catch((cleanupError) => {
        logger.error(`Failed to roll back partial import ${sessionId}`, {
          error: String(cleanupError),
        });
      });
      throw error;
    }

    logger.info(`Imported Claude session ${found.claudeSessionId} as ${sessionId}`, {
      messages: messages.length,
    });

    return {
      claudeSessionId: found.claudeSessionId,
      sessionId,
      name: session.name,
      messageCount: messages.length,
    };
  }

  /** Turn one assistant content block into a board message. */
  private mapBlock(
    block: any
  ): { type: BoardMessageType; content: string; metadata?: Record<string, any> } | null {
    if (!block || typeof block !== 'object') return null;
    switch (block.type) {
      case 'text': {
        const text = (block.text || '').trim();
        return text ? { type: 'assistant', content: text } : null;
      }
      case 'thinking': {
        const text = (block.thinking || '').trim();
        return text ? { type: 'thinking', content: text, metadata: { type: 'thinking' } } : null;
      }
      case 'tool_use':
        return {
          type: 'tool_use',
          content: this.stringify(block.input),
          metadata: { toolName: block.name, toolUseId: block.id },
        };
      default:
        return null;
    }
  }

  private blocks(content: any): any[] {
    return Array.isArray(content) ? content : [];
  }

  /** Content is either a plain string or an array of blocks; get the readable text. */
  private extractText(content: any): string {
    if (typeof content === 'string') return content.trim();
    if (!Array.isArray(content)) return '';
    return content
      .filter((b) => b && (b.type === 'text' || typeof b.text === 'string'))
      .map((b) => b.text || '')
      .join('\n')
      .trim();
  }

  private stringify(value: any): string {
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  private truncate(text: string, max: number): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
  }

  /** Stream a .jsonl transcript line by line, ignoring anything unparseable. */
  private async eachLine(filePath: string, fn: (line: TranscriptLine) => void): Promise<void> {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const raw of rl) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        try {
          fn(JSON.parse(trimmed));
        } catch {
          // A partially written line at the tail of an active session: skip it.
        }
      }
    } finally {
      rl.close();
      stream.close();
    }
  }
}
