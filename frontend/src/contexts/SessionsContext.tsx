import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { sessionApi } from '../services/api';
import { Session, CreateSessionRequest, SessionStatus, SystemStats } from '../types/session.types';
import { useWebSocket } from '../hooks/useWebSocket';

interface SessionsContextValue {
  sessions: Session[];
  sessionsByStatus: Record<string, Session[]>;
  systemStats: SystemStats | null;
  loading: boolean;
  error: string | null;
  loadSessions: () => Promise<void>;
  createSession: (request: CreateSessionRequest) => Promise<Session>;
  completeSession: (sessionId: string) => Promise<Session>;
  interruptSession: (sessionId: string) => Promise<Session>;
  resumeSession: (sessionId: string) => Promise<Session>;
  deleteSession: (sessionId: string) => Promise<void>;
  reorderSessionsByStatus: (status: SessionStatus, reorderedSessions: Session[]) => void;
}

const SessionsContext = createContext<SessionsContextValue | undefined>(undefined);

export const useSessionsContext = () => {
  const context = useContext(SessionsContext);
  if (!context) {
    throw new Error('useSessionsContext must be used within SessionsProvider');
  }
  return context;
};

export const SessionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const initialLoadRef = useRef(false);
  
  const { addEventListener, removeEventListener } = useWebSocket();

  // 載入所有 sessions
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sessionsData, statsData] = await Promise.all([
        sessionApi.getAllSessions(),
        sessionApi.getSystemStats()
      ]);
      setSessions(sessionsData);
      setSystemStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
      console.error('Error loading sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 建立新 session
  const createSession = useCallback(async (request: CreateSessionRequest): Promise<Session> => {
    try {
      setError(null);
      const newSession = await sessionApi.createSession(request);
      setSessions(prev => [newSession, ...prev]);
      return newSession;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // 完成 session
  const completeSession = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      const updatedSession = await sessionApi.completeSession(sessionId);
      
      // 更新狀態並將 session 移到已完成列表的最前面
      setSessions(prev => {
        const session = prev.find(s => s.sessionId === sessionId);
        if (!session) return prev;
        
        // 取得已完成、錯誤、中斷的狀態列表
        const completedStatuses = [SessionStatus.COMPLETED, SessionStatus.ERROR, SessionStatus.INTERRUPTED];
        
        // 合併：其他狀態 + 新完成的（在已完成組的最前面）+ 其他已完成的
        const result: Session[] = [];
        let insertedCompleted = false;
        
        for (const s of prev) {
          if (s.sessionId === sessionId) {
            continue; // 跳過原本的 session
          }
          
          if (!insertedCompleted && completedStatuses.includes(s.status)) {
            // 在遇到第一個已完成類型時，先插入新完成的 session
            result.push(updatedSession);
            insertedCompleted = true;
          }
          
          result.push(s);
        }
        
        // 如果沒有其他已完成的 sessions，將新完成的放在最後
        if (!insertedCompleted) {
          result.push(updatedSession);
        }
        
        return result;
      });
      
      return updatedSession;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // 中斷 session
  const interruptSession = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      const updatedSession = await sessionApi.interruptSession(sessionId);
      setSessions(prev => prev.map(session => 
        session.sessionId === sessionId ? updatedSession : session
      ));
      return updatedSession;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to interrupt session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // 恢復 session
  const resumeSession = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      const updatedSession = await sessionApi.resumeSession(sessionId);
      setSessions(prev => prev.map(session => 
        session.sessionId === sessionId ? updatedSession : session
      ));
      return updatedSession;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resume session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // 刪除 session
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      setError(null);
      await sessionApi.deleteSession(sessionId);
      setSessions(prev => prev.filter(session => session.sessionId !== sessionId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete session';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // 重新排序特定狀態的 sessions
  const reorderSessionsByStatus = useCallback(async (status: SessionStatus, reorderedSessions: Session[]) => {
    // 立即更新本地狀態
    setSessions(prev => {
      // 獲取其他狀態的 sessions
      const otherSessions = prev.filter(session => session.status !== status);
      
      // 合併重新排序的 sessions 和其他狀態的 sessions
      // 保持其他狀態的 sessions 在原來的相對位置
      const newSessions: Session[] = [];
      let reorderedIndex = 0;
      let otherIndex = 0;
      
      // 遍歷原始 sessions，決定是使用重新排序的還是其他的
      for (const session of prev) {
        if (session.status === status) {
          // 使用重新排序的 session
          if (reorderedIndex < reorderedSessions.length) {
            newSessions.push(reorderedSessions[reorderedIndex]);
            reorderedIndex++;
          }
        } else {
          // 使用其他狀態的 session
          if (otherIndex < otherSessions.length) {
            newSessions.push(otherSessions[otherIndex]);
            otherIndex++;
          }
        }
      }
      
      return newSessions;
    });

    // 發送 API 請求保存排序
    try {
      const sessionIds = reorderedSessions.map(s => s.sessionId);
      await sessionApi.reorderSessions(status, sessionIds);
    } catch (error) {
      console.error('Failed to save session order:', error);
      // 可選：如果保存失敗，可以重新載入 sessions
      // await loadSessions();
    }
  }, []);

  // 更新單個 session 狀態
  const updateSessionStatus = useCallback((sessionId: string, status: SessionStatus) => {
    setSessions(prev => prev.map(session => 
      session.sessionId === sessionId 
        ? { 
            ...session, 
            status, 
            updatedAt: new Date(),
            // 如果狀態不是 ERROR，清除錯誤訊息
            error: status === SessionStatus.ERROR ? session.error : undefined
          }
        : session
    ));
  }, []);

  // 監聽 WebSocket 狀態更新
  useEffect(() => {
    const handleStatusUpdate = (data: { sessionId: string; status: string }) => {
      // 將小寫狀態轉換為大寫的 enum 值
      const statusMap: Record<string, SessionStatus> = {
        'processing': SessionStatus.PROCESSING,
        'idle': SessionStatus.IDLE,
        'initializing': SessionStatus.PROCESSING,
        'running': SessionStatus.IDLE,
        'completed': SessionStatus.COMPLETED,
        'error': SessionStatus.ERROR,
        'interrupted': SessionStatus.INTERRUPTED
      };
      
      const mappedStatus = statusMap[data.status.toLowerCase()];
      if (mappedStatus) {
        updateSessionStatus(data.sessionId, mappedStatus);
      }
    };

    const handleProcessExit = (data: { sessionId: string; code: number | null }) => {
      // 只有在執行失敗時才更新狀態為 ERROR
      // 正常執行完成時，狀態應該保持當前狀態（通常是 IDLE）
      if (data.code !== 0) {
        updateSessionStatus(data.sessionId, SessionStatus.ERROR);
      }
      // 注意：不再將 code === 0 的情況設為 COMPLETED
    };

    const handleSessionUpdate = (data: { 
      sessionId: string; 
      lastUserMessage?: string; 
      messageCount?: number;
      updatedAt?: string;
    }) => {
      console.log('=== received session_updated event ===', data);
      setSessions(prev => {
        const updated = prev.map(session => 
          session.sessionId === data.sessionId ? {
            ...session,
            lastUserMessage: data.lastUserMessage || session.lastUserMessage,
            messageCount: data.messageCount || session.messageCount,
            updatedAt: data.updatedAt ? new Date(data.updatedAt) : session.updatedAt
          } : session
        );
        console.log('=== sessions state updated ===');
        return updated;
      });
    };

    // 監聽房間事件（用於詳細頁面）
    addEventListener('status_update', handleStatusUpdate);
    addEventListener('process_exit', handleProcessExit);
    addEventListener('session_updated', handleSessionUpdate);
    
    // 同時監聽全域事件（用於列表頁面）
    addEventListener('global_status_update', handleStatusUpdate);
    addEventListener('global_process_exit', handleProcessExit);

    return () => {
      removeEventListener('status_update', handleStatusUpdate);
      removeEventListener('process_exit', handleProcessExit);
      removeEventListener('session_updated', handleSessionUpdate);
      removeEventListener('global_status_update', handleStatusUpdate);
      removeEventListener('global_process_exit', handleProcessExit);
    };
  }, [addEventListener, removeEventListener, updateSessionStatus]);

  // 初始化載入 - 使用 ref 避免重複請求
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      loadSessions();
    }
  }, [loadSessions]);

  // 按狀態分組的 sessions
  const sessionsByStatus = {
    idle: sessions.filter(s => s.status === SessionStatus.IDLE),
    completed: sessions.filter(s => s.status === SessionStatus.COMPLETED),
    error: sessions.filter(s => s.status === SessionStatus.ERROR),
    interrupted: sessions.filter(s => s.status === SessionStatus.INTERRUPTED),
    processing: sessions.filter(s => s.status === SessionStatus.PROCESSING),
  };

  const value: SessionsContextValue = {
    sessions,
    sessionsByStatus,
    systemStats,
    loading,
    error,
    loadSessions,
    createSession,
    completeSession,
    interruptSession,
    resumeSession,
    deleteSession,
    reorderSessionsByStatus,
  };

  return (
    <SessionsContext.Provider value={value}>
      {children}
    </SessionsContext.Provider>
  );
};