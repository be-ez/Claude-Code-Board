import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Square,
  RotateCcw,
  Trash2,
  Download,
  Folder,
  CheckCircle,
  Settings,
  Plus
} from 'lucide-react';
import { sessionApi, projectApi, tagApi } from '../../services/api';
import { Session, Message, SessionStatus } from '../../types/session.types';
import { Project, Tag } from '../../types/classification.types';
import { ChatInterface } from './ChatInterface';
import { LoadingSpinner } from '../Common/LoadingSpinner';
import { cn, getStatusColor, getStatusText } from '../../utils';
import { useSessions } from '../../hooks/useSessions';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useMessageStore } from '../../stores/messageStore';
import { claudeImportApi } from '../../services/claudeImportService';
import { WebSocketError } from '../../services/websocket';
import toast from 'react-hot-toast';
import { Tooltip } from '../Common/Tooltip';
import { ProjectSelector } from '../Classification/ProjectSelector';
import { TagSelector } from '../Classification/TagSelector';
import { CreateSessionModal } from './CreateSessionModal';
import { useTranslation } from 'react-i18next';

interface SessionDetailProps {
  sessionId?: string;
  embedded?: boolean;
}

const SessionDetailComponent: React.FC<SessionDetailProps> = ({ sessionId: propSessionId, embedded = false }) => {
  const { t } = useTranslation();
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const sessionId = propSessionId || urlSessionId;
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClassification, setShowClassification] = useState(false);
  const [sessionProjects, setSessionProjects] = useState<string[]>([]);
  const [_sessionTags, setSessionTags] = useState<string[]>([]);
  const [topicTags, setTopicTags] = useState<string[]>([]);
  const [showQuickStart, setShowQuickStart] = useState(false);
  
  const { completeSession, interruptSession, resumeSession, deleteSession } = useSessions();
  const { addEventListener, removeEventListener } = useWebSocket();

  useEffect(() => {
    if (!sessionId) {
      if (!embedded) {
        navigate('/');
      }
      return;
    }

    loadSessionDetails();
  }, [sessionId, navigate, embedded]);

  // 監聽 WebSocket 狀態更新
  useEffect(() => {
    if (!sessionId) return;

    const handleStatusUpdate = (data: { sessionId: string; status: string }) => {
      if (data.sessionId === sessionId) {
        console.log('Status update received:', data.status);
        setSession(prev => {
          if (!prev) return prev;
          
          // 將狀態字串轉換為 SessionStatus 枚舉
          let newStatus: SessionStatus;
          switch (data.status) {
            case 'idle':
              newStatus = SessionStatus.IDLE;
              break;
            case 'processing':
              newStatus = SessionStatus.PROCESSING;
              break;
            case 'error':
              newStatus = SessionStatus.ERROR;
              break;
            case 'completed':
              newStatus = SessionStatus.COMPLETED;
              break;
            case 'interrupted':
              newStatus = SessionStatus.INTERRUPTED;
              break;
            default:
              return prev;
          }
          
          return {
            ...prev,
            status: newStatus,
            // 如果狀態變為 idle，清除錯誤訊息
            error: newStatus === SessionStatus.IDLE ? undefined : prev.error
          };
        });
      }
    };

    addEventListener('status_update', handleStatusUpdate);
    addEventListener('global_status_update', handleStatusUpdate);

    return () => {
      removeEventListener('status_update', handleStatusUpdate);
      removeEventListener('global_status_update', handleStatusUpdate);
    };
  }, [sessionId, addEventListener, removeEventListener]);

  // 監聽 WebSocket 錯誤事件
  useEffect(() => {
    if (!sessionId) return;

    const handleError = (data: WebSocketError) => {
      if (data.sessionId === sessionId) {
        console.error('Session error received:', data);
        
        // 顯示詳細的錯誤訊息
        const errorMessage = data.error || t('sessionDetail.unknownRuntimeError');
        const errorDetails = [];
        
        if (data.errorType) {
          errorDetails.push(t('sessionDetail.errorType', { type: data.errorType }));
        }
        
        if (data.details?.stderr) {
          errorDetails.push(t('sessionDetail.errorDetails', { details: data.details.stderr }));
        }
        
        if (data.details?.exitCode) {
          errorDetails.push(t('sessionDetail.exitCode', { code: data.details.exitCode }));
        }
        
        // 顯示錯誤通知
        toast.error(
          <div>
            <div className="font-semibold">{errorMessage}</div>
            {errorDetails.length > 0 && (
              <div className="text-sm mt-1">
                {errorDetails.map((detail, index) => (
                  <div key={index}>{detail}</div>
                ))}
              </div>
            )}
          </div>,
          { duration: 10000 }
        );
        
        // 更新 session 狀態
        setSession(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            status: SessionStatus.ERROR,
            error: JSON.stringify({
              message: data.error,
              type: data.errorType,
              details: data.details,
              timestamp: data.timestamp
            })
          };
        });
      }
    };

    addEventListener('error', handleError);

    return () => {
      removeEventListener('error', handleError);
    };
  }, [sessionId, addEventListener, removeEventListener]);

  const handleSessionUpdate = (updates: Partial<Session>) => {
    console.log('=== SessionDetail handleSessionUpdate ===', updates);
    setSession(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        ...updates
      };
      console.log('=== SessionDetail session before update ===', prev);
      console.log('=== SessionDetail session after update ===', updated);
      return updated;
    });
  };

  /**
   * Pull new messages from this session's Claude Code transcript. Runs quietly:
   * a session that is already current says nothing, and a failure to reach the
   * transcript must not block opening the session.
   */
  const syncImportedSession = async (id: string) => {
    try {
      const result = await claudeImportApi.syncSession(id);
      if (result.added > 0) {
        toast.success(t('importSessions.synced', { count: result.added }));
        // The store owns the message list; make it re-read what sync just added.
        await useMessageStore.getState().initializeFromAPI(id);
      }
    } catch (error) {
      console.error('Failed to sync session from transcript:', error);
    }
  };

  const loadSessionDetails = async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      setError(null);
      
      // 並行載入 session 資料、專案和標籤
      const [sessionData, projects, tags] = await Promise.all([
        sessionApi.getSession(sessionId),
        projectApi.getProjectsBySessionId(sessionId).catch(() => []),
        tagApi.getTagsBySessionId(sessionId).catch(() => [])
      ]);
      
      console.log('=== SessionDetail API response data ===');
      console.log('sessionData:', sessionData);
      console.log('projects:', projects);
      console.log('tags:', tags);
      
      setSession(sessionData);
      setSessionProjects(projects.map((p: Project) => p.project_id));

      // An imported session is a snapshot of a transcript that Claude Code may
      // still be writing to, so pull in anything new on open.
      if (sessionData?.claudeSessionId) {
        void syncImportedSession(sessionId);
      }
      
      // 根據標籤類型分組
      const allTagIds = tags.map((t: Tag) => t.tag_id);
      const topicTagIds = tags.filter((t: Tag) => t.type === 'topic').map((t: Tag) => t.tag_id);
      
      setSessionTags(allTagIds);
      setTopicTags(topicTagIds);
      
      // 不再這裡載入訊息，交給 ChatInterface 的 messageStore 處理
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session details');
      console.error('Error loading session details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!sessionId) return;
    
    try {
      const updatedSession = await completeSession(sessionId);
      setSession(updatedSession);
      toast.success(t('sessionDetail.markedComplete'));
    } catch (error) {
      toast.error(t('sessionDetail.completeFailed'));
    }
  };

  const handleInterrupt = async () => {
    if (!sessionId) return;
    
    try {
      const updatedSession = await interruptSession(sessionId);
      setSession(updatedSession);
      toast.success(t('sessionDetail.interrupted'));
    } catch (error) {
      toast.error(t('sessionDetail.interruptFailed'));
    }
  };

  const handleResume = async () => {
    if (!sessionId) return;
    
    try {
      const updatedSession = await resumeSession(sessionId);
      setSession(updatedSession);
      toast.success(t('sessionDetail.resumed'));
    } catch (error) {
      toast.error(t('sessionDetail.resumeFailed'));
    }
  };

  // handleContinue 函數已移除，因為用戶現在可以直接在聊天介面中繼續對話

  const handleDelete = async () => {
    if (!sessionId) return;
    
    if (!confirm(t('sessionDetail.confirmDelete'))) {
      return;
    }

    try {
      await deleteSession(sessionId);
      toast.success(t('sessionDetail.deleted'));
      if (!embedded) {
        navigate('/');
      }
    } catch (error) {
      toast.error(t('sessionDetail.deleteFailed'));
    }
  };

  const handleExportMessages = () => {
    if (!messages.length) {
      toast.error(t('sessionDetail.nothingToExport'));
      return;
    }

    const exportData = {
      session: {
        id: session?.sessionId,
        name: session?.name,
        task: session?.task,
        workingDir: session?.workingDir,
        status: session?.status,
        createdAt: session?.createdAt,
        updatedAt: session?.updatedAt,
      },
      messages: messages.map(msg => ({
        type: msg.type,
        content: msg.content,
        timestamp: msg.timestamp,
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${session?.name || sessionId}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(t('sessionDetail.exported'));
  };

  const handleQuickStart = () => {
    setShowQuickStart(true);
  };

  const handleQuickStartCreated = (newSession: Session) => {
    setShowQuickStart(false);
    toast.success(t('sessionDetail.newSessionCreated'));
    // 導航到新的 Session
    navigate(`/sessions/${newSession.sessionId}`);
  };

  // 準備預填資料
  const getPrefillData = () => {
    if (!session) return undefined;

    return {
      baseSessionName: session.name,
      workingDir: session.workingDir,
      work_item_id: session.work_item_id,
      workflow_stage_id: session.workflow_stage_id,
      name: t('sessionDetail.newTaskName', { name: session.name }),
      task: t('sessionDetail.followUpTask'),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner text={t('sessionDetail.loading')} />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error || t('sessionDetail.notFound')}</div>
        {!embedded && (
          <button 
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            {t('sessionDetail.backToList')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 頁面標題和操作 */}
      <div className="glass-card border-b border-glass-border px-3 py-2">
        <div className="pl-24">
          {/* 標題和狀態 */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <h1 className="text-lg font-bold text-gray-900 truncate flex-1 min-w-0">
              {session.name}
            </h1>
            <div className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
              getStatusColor(session.status)
            )}>
              {getStatusText(session.status)}
            </div>
          </div>
          
          {/* 元資訊 - 極簡模式 */}
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <div className="flex items-center gap-1 min-w-0">
              <Folder className="w-3 h-3 flex-shrink-0" />
              <span className="truncate" title={session.workingDir}>
                {session.workingDir.split('/').pop() || 'root'}
              </span>
            </div>
            {/* 操作按鈕 - 移到第二行 */}
            <div className="flex items-center gap-1 mt-1.5">
              <Tooltip content={t('sessionDetail.classification')}>
                <button
                  onClick={() => setShowClassification(!showClassification)}
                  className={cn(
                    "p-1.5 rounded-lg transition-all hover:shadow-soft-sm",
                    showClassification
                      ? "bg-primary-100 text-primary-600"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </Tooltip>

              <Tooltip content={t('sessionDetail.exportConversation')}>
                <button
                  onClick={handleExportMessages}
                  className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-lg transition-all hover:shadow-soft-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </Tooltip>

              <Tooltip content={t('sessionDetail.quickStartFromHere')}>
                <button
                  onClick={handleQuickStart}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all hover:shadow-soft-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </Tooltip>

              {/* 根據狀態顯示不同操作 */}
              {session.status === SessionStatus.PROCESSING && (
                <Tooltip content={t('session.interrupt')}>
                  <button
                    onClick={handleInterrupt}
                    className="p-1.5 text-warning-600 hover:bg-warning-50 rounded-lg transition-all hover:shadow-soft-sm"
                  >
                    <Square className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              )}
              
              {session.status === SessionStatus.IDLE && (
                <Tooltip content={t('session.markComplete')}>
                  <button
                    onClick={handleComplete}
                    className="p-1.5 text-success-600 hover:bg-success-50 rounded-lg transition-all hover:shadow-soft-sm"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              )}

              {session.status === SessionStatus.INTERRUPTED && (
                <>
                  <Tooltip content={t('session.resume')}>
                    <button
                      onClick={handleResume}
                      className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-all hover:shadow-soft-sm"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                  <Tooltip content={t('session.markComplete')}>
                    <button
                      onClick={handleComplete}
                      className="p-1.5 text-success-600 hover:bg-success-50 rounded-lg transition-all hover:shadow-soft-sm"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                    </button>
                  </Tooltip>
                </>
              )}

              {/* COMPLETED 和 ERROR 狀態的 Session 可以直接在聊天介面中繼續對話 */}

              <Tooltip content={t('session.delete')}>
                <button
                  onClick={handleDelete}
                  className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition-all hover:shadow-soft-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* 分類管理面板 */}
        {showClassification && (
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="space-y-4">
              <ProjectSelector
                sessionId={sessionId!}
                selectedProjects={sessionProjects}
                onProjectsChange={setSessionProjects}
              />
              <TagSelector
                sessionId={sessionId!}
                selectedTags={topicTags}
                onTagsChange={setTopicTags}
                tagType="topic"
              />
            </div>
          </div>
        )}

        {/* 錯誤訊息 */}
        {session.error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-sm font-medium text-red-700 mb-2">{t('sessionDetail.errorMessageLabel')}</h3>
            <p className="text-red-600 text-sm">{session.error}</p>
          </div>
        )}
      </div>

      {/* 聊天介面 */}
      <div className="flex-1 overflow-hidden">
        <ChatInterface
          sessionId={sessionId!}
          session={session}
          initialMessages={messages}
          isSessionActive={session.status === SessionStatus.IDLE || session.status === SessionStatus.PROCESSING || session.status === SessionStatus.COMPLETED || session.status === SessionStatus.ERROR}
          isProcessing={session.status === SessionStatus.PROCESSING}
          onSessionUpdate={handleSessionUpdate}
        />
      </div>

      {/* 快速啟動 Modal */}
      <CreateSessionModal
        isOpen={showQuickStart}
        onClose={() => setShowQuickStart(false)}
        prefillData={getPrefillData()}
        onCreated={handleQuickStartCreated}
      />
    </div>
  );
};

// 使用 React.memo 來防止不必要的重新渲染
export const SessionDetail = React.memo(SessionDetailComponent);