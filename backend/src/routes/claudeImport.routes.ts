import { Router, Request, Response } from 'express';
import { ClaudeSessionImportService } from '../services/ClaudeSessionImportService';
import { SessionRepository } from '../repositories/SessionRepository';
import { MessageRepository } from '../repositories/MessageRepository';
import { logger } from '../utils/logger';

const router = Router();
const importService = new ClaudeSessionImportService(
  new SessionRepository(),
  new MessageRepository()
);

/**
 * GET /api/claude-import/sessions
 * List the Claude Code transcripts found on disk, flagging ones already imported.
 */
router.get('/sessions', async (_req: Request, res: Response) => {
  try {
    const sessions = await importService.discover();
    res.json({
      projectsPath: importService.getProjectsPath(),
      sessions,
    });
  } catch (error: any) {
    logger.error('Failed to discover Claude sessions', { error: String(error) });
    res.status(500).json({ error: error?.message || 'Failed to discover Claude sessions' });
  }
});

/**
 * POST /api/claude-import/sessions
 * Import the selected transcripts as board sessions.
 * Body: { claudeSessionIds: string[] }
 */
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { claudeSessionIds } = req.body;
    if (!Array.isArray(claudeSessionIds) || claudeSessionIds.length === 0) {
      return res.status(400).json({ error: 'claudeSessionIds must be a non-empty array' });
    }

    const result = await importService.import(claudeSessionIds);
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to import Claude sessions', { error: String(error) });
    res.status(500).json({ error: error?.message || 'Failed to import Claude sessions' });
  }
});

/**
 * POST /api/claude-import/sessions/:sessionId/sync
 * Pull anything new from this session's Claude Code transcript.
 */
router.post('/sessions/:sessionId/sync', async (req: Request, res: Response) => {
  try {
    const result = await importService.sync(req.params.sessionId);
    if (result.status === 'not_found') {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(result);
  } catch (error: any) {
    logger.error('Failed to sync Claude session', { error: String(error) });
    res.status(500).json({ error: error?.message || 'Failed to sync session' });
  }
});

export default router;
