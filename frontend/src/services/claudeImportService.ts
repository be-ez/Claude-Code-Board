import axiosInstance from '../utils/axiosInstance';

/** A Claude Code transcript found on disk that can be pulled onto the board. */
export interface DiscoveredClaudeSession {
  claudeSessionId: string;
  filePath: string;
  workingDir: string;
  title: string;
  messageCount: number;
  startedAt: string | null;
  lastActivityAt: string | null;
  sizeBytes: number;
  alreadyImported: boolean;
  importedSessionId?: string;
}

export interface DiscoverResponse {
  projectsPath: string;
  sessions: DiscoveredClaudeSession[];
}

export interface SyncResult {
  added: number;
  status: 'synced' | 'up_to_date' | 'not_imported' | 'transcript_missing' | 'not_found';
}

export interface ImportResult {
  imported: { claudeSessionId: string; sessionId: string; name: string; messageCount: number }[];
  skipped: { claudeSessionId: string; reason: string }[];
}

export const claudeImportApi = {
  async discover(): Promise<DiscoverResponse> {
    const { data } = await axiosInstance.get<DiscoverResponse>('/claude-import/sessions');
    return data;
  },

  /** Pull anything new from this session's Claude Code transcript. */
  async syncSession(sessionId: string): Promise<SyncResult> {
    const { data } = await axiosInstance.post<SyncResult>(
      `/claude-import/sessions/${sessionId}/sync`
    );
    return data;
  },

  async importSessions(claudeSessionIds: string[]): Promise<ImportResult> {
    const { data } = await axiosInstance.post<ImportResult>('/claude-import/sessions', {
      claudeSessionIds,
    });
    return data;
  },
};
