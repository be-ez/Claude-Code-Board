import { Plus } from "lucide-react";
import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useDeviceType } from "../../hooks/useMediaQuery";
import { useSessions } from "../../hooks/useSessions";
import { Session, SessionStatus } from "../../types/session.types";
import { EmptyState } from "../Common/EmptyState";
import { LoadingSpinner } from "../Common/LoadingSpinner";
import { SessionCard } from "./SessionCard";
import { SearchBar } from "../Common/SearchBar";
import { SortSelector } from "../Common/SortSelector";
import { sortSessions, getSortOptions, SortType } from "../../utils/sessionSort";
import { useTranslation } from 'react-i18next';

interface SessionListProps {
  onCreateSession: () => void;
}

interface KanbanColumnProps {
  title: string;
  color: "yellow" | "green" | "blue" | "red";
  sessions: Session[];
  searchTerm: string;
  onComplete: (sessionId: string) => void;
  onInterrupt: (sessionId: string) => void;
  onResume: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  onReorder?: (reorderedSessions: Session[]) => void;
  disableDrag?: boolean;
}

const KanbanColumn: React.FC<KanbanColumnProps & { sortType?: SortType }> = ({ title, color, sessions, searchTerm, onComplete, onInterrupt, onResume, onDelete, onReorder, disableDrag = false, sortType = 'updated_desc' }) => {
  const { t } = useTranslation();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  // 過濾並排序 sessions
  const filteredSessions = useMemo(() => {
    let filtered = sessions;
    
    // 先過濾
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = sessions.filter((session) => 
        session.name.toLowerCase().includes(term) || 
        session.task.toLowerCase().includes(term) || 
        session.workingDir.toLowerCase().includes(term)
      );
    }
    
    // 再排序
    return sortSessions(filtered, sortType);
  }, [sessions, searchTerm, sortType]);

  const getColorClasses = () => {
    switch (color) {
      case "yellow":
        return {
          header: "bg-gradient-to-r from-warning-50 to-warning-100/50",
          title: "text-warning-700",
          count: "bg-warning-100 text-warning-700 border border-warning-200",
        };
      case "green":
        return {
          header: "bg-gradient-to-r from-success-50 to-success-100/50",
          title: "text-success-700",
          count: "bg-success-100 text-success-700 border border-success-200",
        };
      case "blue":
        return {
          header: "bg-gradient-to-r from-primary-50 to-primary-100/50",
          title: "text-primary-700",
          count: "bg-primary-100 text-primary-700 border border-primary-200",
        };
      case "red":
        return {
          header: "bg-gradient-to-r from-danger-50 to-danger-100/50",
          title: "text-danger-700",
          count: "bg-danger-100 text-danger-700 border border-danger-200",
        };
    }
  };

  const colorClasses = getColorClasses();

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      return;
    }

    // 獲取被拖曳的 session
    const draggedSession = filteredSessions[draggedIndex];
    const dropSession = filteredSessions[dropIndex];

    // 找到在原始 sessions 陣列中的索引
    const originalDraggedIndex = sessions.findIndex((s) => s.sessionId === draggedSession.sessionId);
    const originalDropIndex = sessions.findIndex((s) => s.sessionId === dropSession.sessionId);

    if (originalDraggedIndex === -1 || originalDropIndex === -1) {
      return;
    }

    // 重新排序原始 sessions
    const newSessions = [...sessions];
    newSessions.splice(originalDraggedIndex, 1);
    newSessions.splice(originalDropIndex, 0, draggedSession);

    // 調用 onReorder 來更新狀態
    onReorder?.(newSessions);

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const deviceType = useDeviceType();

  return (
    <div className={`glass-card rounded-xl shadow-soft flex flex-col ${deviceType === "mobile" ? "h-[calc(100vh-280px)]" : "h-[600px]"} ${deviceType === "desktop" ? "min-w-[280px]" : ""}`}>
      {/* 欄位標題 */}
      <div className={`px-4 py-3 border-b border-glass-border rounded-t-xl flex-shrink-0 ${colorClasses.header}`}>
        <div className="flex items-center justify-between">
          <h3 className={`font-semibold ${colorClasses.title}`}>{title}</h3>
          <span className={`inline-flex items-center justify-center w-7 h-7 text-xs font-medium rounded-full shadow-soft-sm ${colorClasses.count}`}>{filteredSessions.length}</span>
        </div>
      </div>

      {/* Sessions 列表 */}
      <div className="p-3 space-y-2 flex-1 overflow-y-auto">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">{t('sessionList.empty')}</p>
          </div>
        ) : (
          filteredSessions.map((session, index) => (
            <div key={session.sessionId} className={`transform hover:scale-102 transition-transform ${!disableDrag && dragOverIndex === index ? "border-t-2 border-blue-500" : ""}`} onDragOver={!disableDrag ? (e) => handleDragOver(e, index) : undefined} onDrop={!disableDrag ? (e) => handleDrop(e, index) : undefined}>
              <SessionCard session={session} index={index} onComplete={() => onComplete(session.sessionId)} onInterrupt={() => onInterrupt(session.sessionId)} onResume={() => onResume(session.sessionId)} onDelete={() => onDelete(session.sessionId)} onDragStart={!disableDrag ? handleDragStart : undefined} onDragEnd={!disableDrag ? handleDragEnd : undefined} isDragging={!disableDrag && draggedIndex === index} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const SessionList: React.FC<SessionListProps> = ({ onCreateSession }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"processing" | "idle" | "completed">("idle");
  const [sortType, setSortType] = useState<SortType>('updated_desc');
  const deviceType = useDeviceType();

  const { sessions, sessionsByStatus, loading, error, completeSession, interruptSession, resumeSession, deleteSession, reorderSessionsByStatus } = useSessions();

  const handleComplete = async (sessionId: string) => {
    try {
      await completeSession(sessionId);
      toast.success(t('sessionDetail.markedComplete'));
    } catch (error) {
      toast.error(t('sessionDetail.completeFailed'));
    }
  };

  const handleInterrupt = async (sessionId: string) => {
    try {
      await interruptSession(sessionId);
      toast.success(t('sessionDetail.interrupted'));
    } catch (error) {
      toast.error(t('sessionDetail.interruptFailed'));
    }
  };

  const handleResume = async (sessionId: string) => {
    try {
      await resumeSession(sessionId);
      toast.success(t('sessionDetail.resumed'));
    } catch (error) {
      toast.error(t('sessionDetail.resumeFailed'));
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm(t('sessionDetail.confirmDelete'))) {
      return;
    }

    try {
      await deleteSession(sessionId);
      toast.success(t('sessionDetail.deleted'));
    } catch (error) {
      toast.error(t('sessionDetail.deleteFailed'));
    }
  };
  
  // 不再需要 handleContinue，因為用戶可以直接在聊天介面中繼續對話

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          {t('common.reload')}
        </button>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col min-w-0`}>
      {/* 固定的頂部區域 - 包含標題、搜尋和建立按鈕 */}
      <div className={`glass-card rounded-b-none border-b border-glass-border ${deviceType === "mobile" ? "px-4" : "px-6"} py-4 flex-shrink-0`}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Sessions</h1>

          {/* 搜尋框、排序和建立按鈕 */}
          <div className="flex items-center gap-2">
            {/* 排序選擇器 */}
            <SortSelector
              options={getSortOptions()}
              value={sortType}
              onChange={(value) => setSortType(value as SortType)}
              className="hidden sm:block"
            />
            
            {/* 搜尋框 */}
            <SearchBar
              placeholder={t('common.search')}
              onSearch={setSearchTerm}
              defaultValue={searchTerm}
              className="w-24 sm:w-32"
            />

            {/* 建立按鈕 */}
            <button onClick={onCreateSession} className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('common.create')}</span>
            </button>
          </div>
        </div>
        
        {/* 手機版排序選擇器 */}
        {deviceType === "mobile" && sessions.length > 0 && (
          <div className="mt-3">
            <SortSelector
              options={getSortOptions()}
              value={sortType}
              onChange={(value) => setSortType(value as SortType)}
              className="w-full"
            />
          </div>
        )}
      </div>

      {/* 內容區域 */}
      <div className="flex-1 overflow-auto">
        <div className={`h-full ${deviceType === "mobile" ? "p-4" : "p-6"}`}>
          {/* Kanban 看板 */}
          {sessions.length === 0 ? (
            <EmptyState title={t('sessionList.noResults')} description={t('sessionList.noneYet')} actionText={t('sessionList.createFirst')} onAction={onCreateSession} />
          ) : (
            <>
              {/* 行動版標籤頁 */}
              {deviceType === "mobile" && (
                <div className="glass-card rounded-xl shadow-soft p-1 mb-4 overflow-x-auto">
                  <div className="flex">
                    <button onClick={() => setActiveTab("processing")} className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-all ${activeTab === "processing" ? "bg-warning-100 text-warning-700 shadow-soft-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                      {t('sessionList.processingCount', { count: sessionsByStatus[SessionStatus.PROCESSING]?.length || 0 })}
                    </button>
                    <button onClick={() => setActiveTab("idle")} className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-all ${activeTab === "idle" ? "bg-success-100 text-success-700 shadow-soft-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                      {t('sessionList.idleCount', { count: sessionsByStatus[SessionStatus.IDLE]?.length || 0 })}
                    </button>
                    <button onClick={() => setActiveTab("completed")} className={`px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-all ${activeTab === "completed" ? "bg-primary-100 text-primary-700 shadow-soft-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                      {t('sessionList.completedCount', { count: [...(sessionsByStatus[SessionStatus.COMPLETED] || []), ...(sessionsByStatus[SessionStatus.ERROR] || []), ...(sessionsByStatus[SessionStatus.INTERRUPTED] || [])].length })}
                    </button>
                  </div>
                </div>
              )}

              <div className={deviceType === "mobile" ? "space-y-4 w-full" : "grid grid-cols-3 gap-4 md:gap-6 min-w-[900px]"}>
                {/* 行動版：根據選中的標籤顯示單一欄位 */}
                {deviceType === "mobile" ? (
                  <>
                    {activeTab === "processing" && <KanbanColumn title={t('sessionList.processing')} color="yellow" sessions={sessionsByStatus[SessionStatus.PROCESSING] || []} searchTerm={searchTerm} sortType={sortType} onComplete={handleComplete} onInterrupt={handleInterrupt} onResume={handleResume} onDelete={handleDelete} disableDrag={true} />}

                    {activeTab === "idle" && <KanbanColumn title={t('sessionList.idle')} color="green" sessions={sessionsByStatus[SessionStatus.IDLE] || []} searchTerm={searchTerm} sortType={sortType} onComplete={handleComplete} onInterrupt={handleInterrupt} onResume={handleResume} onDelete={handleDelete} onReorder={(reorderedSessions) => reorderSessionsByStatus(SessionStatus.IDLE, reorderedSessions)} />}

                    {activeTab === "completed" && (
                      <KanbanColumn
                        title={t('common.completed')}
                        color="blue"
                        sessions={[...(sessionsByStatus[SessionStatus.COMPLETED] || []), ...(sessionsByStatus[SessionStatus.ERROR] || []), ...(sessionsByStatus[SessionStatus.INTERRUPTED] || [])]}
                        searchTerm={searchTerm}
                        sortType={sortType}
                        onComplete={handleComplete}
                        onInterrupt={handleInterrupt}
                        onResume={handleResume}
                        onDelete={handleDelete}
                        onReorder={(reorderedSessions) => {
                          const completedSessions = reorderedSessions.filter((s) => s.status === SessionStatus.COMPLETED);
                          const errorSessions = reorderedSessions.filter((s) => s.status === SessionStatus.ERROR);
                          const interruptedSessions = reorderedSessions.filter((s) => s.status === SessionStatus.INTERRUPTED);

                          if (completedSessions.length > 0) {
                            reorderSessionsByStatus(SessionStatus.COMPLETED, completedSessions);
                          }
                          if (errorSessions.length > 0) {
                            reorderSessionsByStatus(SessionStatus.ERROR, errorSessions);
                          }
                          if (interruptedSessions.length > 0) {
                            reorderSessionsByStatus(SessionStatus.INTERRUPTED, interruptedSessions);
                          }
                        }}
                      />
                    )}
                  </>
                ) : (
                  <>
                    {/* 桌面版和平板版：顯示所有欄位 */}
                    <KanbanColumn title={t('sessionList.processing')} color="yellow" sessions={sessionsByStatus[SessionStatus.PROCESSING] || []} searchTerm={searchTerm} sortType={sortType} onComplete={handleComplete} onInterrupt={handleInterrupt} onResume={handleResume} onDelete={handleDelete} disableDrag={true} />

                    <KanbanColumn title={t('sessionList.idle')} color="green" sessions={sessionsByStatus[SessionStatus.IDLE] || []} searchTerm={searchTerm} sortType={sortType} onComplete={handleComplete} onInterrupt={handleInterrupt} onResume={handleResume} onDelete={handleDelete} onReorder={(reorderedSessions) => reorderSessionsByStatus(SessionStatus.IDLE, reorderedSessions)} />

                    <KanbanColumn
                      title={t('common.completed')}
                      color="blue"
                      sessions={[...(sessionsByStatus[SessionStatus.COMPLETED] || []), ...(sessionsByStatus[SessionStatus.ERROR] || []), ...(sessionsByStatus[SessionStatus.INTERRUPTED] || [])]}
                      searchTerm={searchTerm}
                      sortType={sortType}
                      onComplete={handleComplete}
                      onInterrupt={handleInterrupt}
                      onResume={handleResume}
                      onDelete={handleDelete}
                      onReorder={(reorderedSessions) => {
                        const completedSessions = reorderedSessions.filter((s) => s.status === SessionStatus.COMPLETED);
                        const errorSessions = reorderedSessions.filter((s) => s.status === SessionStatus.ERROR);
                        const interruptedSessions = reorderedSessions.filter((s) => s.status === SessionStatus.INTERRUPTED);

                        if (completedSessions.length > 0) {
                          reorderSessionsByStatus(SessionStatus.COMPLETED, completedSessions);
                        }
                        if (errorSessions.length > 0) {
                          reorderSessionsByStatus(SessionStatus.ERROR, errorSessions);
                        }
                        if (interruptedSessions.length > 0) {
                          reorderSessionsByStatus(SessionStatus.INTERRUPTED, interruptedSessions);
                        }
                      }}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
