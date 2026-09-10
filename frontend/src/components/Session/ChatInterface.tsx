import { AlertCircle, Bot } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type AppendMessage,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { sessionApi } from "../../services/api";
import { WebSocketMessage } from "../../services/websocket";
import { useMessageStore } from "../../stores/messageStore";
import { Message, Session } from "../../types/session.types";
import { toThreadMessages } from "../../utils/threadMessages";
import { Thread } from "./Thread";
import { MessageFilter } from "./MessageFilter";
import { useTranslation } from 'react-i18next';

interface ChatInterfaceProps {
  sessionId: string;
  session?: Session;
  initialMessages: Message[];
  isSessionActive: boolean;
  isProcessing?: boolean;
  onSessionUpdate?: (updates: Partial<Session>) => void;
}

/** Pull the plain text out of whatever the composer produced. */
const appendedText = (message: AppendMessage): string =>
  message.content
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ sessionId, session, isSessionActive, isProcessing = false, onSessionUpdate }) => {
  const { t } = useTranslation();
  // 使用 message store - 分別獲取 actions 和 state
  const messages = useMessageStore((state) => state.messages);
  const isLoading = useMessageStore((state) => state.isLoading);
  const isLoadingMore = useMessageStore((state) => state.isLoadingMore);
  const error = useMessageStore((state) => state.error);
  const initializeFromAPI = useMessageStore((state) => state.initializeFromAPI);
  const loadMoreMessages = useMessageStore((state) => state.loadMoreMessages);
  const canLoadMore = useMessageStore((state) => state.canLoadMore);
  const addMessage = useMessageStore((state) => state.addMessage);
  const updateMessageStatus = useMessageStore((state) => state.updateMessageStatus);

  // 訊息過濾狀態 - 從 localStorage 讀取或使用預設值
  const [hiddenMessageTypes, setHiddenMessageTypes] = useState<Set<Message['type']>>(() => {
    // 預設隱藏 thinking（工具呼叫現在與輸出成對顯示，預設顯示）
    const defaults = new Set(['thinking'] as Message['type'][]);
    const saved = localStorage.getItem('messageFilterHiddenTypes');
    if (!saved) return defaults;
    try {
      const parsed = JSON.parse(saved) as Message['type'][];
      // Anyone still carrying the old default would now see tool cards with no
      // results, since output used to be part of the tool_use stream. Treat that
      // exact saved set as "never customised" and move them to the new default.
      const isLegacyDefault =
        parsed.length === 2 && parsed.includes('tool_use') && parsed.includes('thinking');
      return isLegacyDefault ? defaults : new Set(parsed);
    } catch {
      return defaults;
    }
  });

  // 當過濾設置改變時，保存到 localStorage
  const handleFilterChange = useCallback((types: Set<Message['type']>) => {
    setHiddenMessageTypes(types);
    localStorage.setItem('messageFilterHiddenTypes', JSON.stringify(Array.from(types)));
  }, []);

  // 過濾後的原始訊息，再組成 assistant-ui 的 thread 格式
  const { threadMessages, filteredCount } = useMemo(() => {
    const allMessages = Array.from(messages.values());
    const filtered = allMessages.filter((message) => !hiddenMessageTypes.has(message.type));
    return {
      threadMessages: toThreadMessages(filtered),
      filteredCount: allMessages.length - filtered.length,
    };
  }, [messages, hiddenMessageTypes]);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { addEventListener, removeEventListener, subscribe, unsubscribe } = useWebSocket();

  // 1️⃣ 初始載入（頁面載入/重新整理時）
  useEffect(() => {
    if (sessionId) {
      const state = useMessageStore.getState();
      // 只有在切換到不同 session 或尚未初始化時才載入
      if (state.currentSessionId !== sessionId || !state.isInitialized) {
        // 重置舊資料並從 API 載入歷史訊息
        state.reset();
        state.initializeFromAPI(sessionId);
      }
    }

    return () => {
      // 清理時重置 store
      useMessageStore.getState().reset();
    };
  }, [sessionId]); // 只依賴 sessionId

  // 2️⃣ WebSocket 即時訊息監聽
  useEffect(() => {
    if (!sessionId) return;

    // WebSocket 事件處理函數
    const handleWebSocketMessage = (data: WebSocketMessage) => {
      if (data.sessionId !== sessionId) return;

      // 轉換 WebSocket 訊息為標準 Message 格式，保留原始類型
      const message: Message = {
        messageId: data.messageId || `ws-${Date.now()}-${Math.random()}`,
        sessionId: data.sessionId,
        type: data.type as Message["type"], // 保留原始類型，不做轉換
        content: data.content || "",
        timestamp: data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp),
        metadata: data.metadata,
      };

      addMessage(message);
    };

    // 訂閱這個 session
    subscribe(sessionId);

    // 只監聽統一的 message 事件
    // （WebSocket 服務已經修改為所有訊息都觸發 message 事件）
    addEventListener("message" as any, handleWebSocketMessage);

    // 清理函數
    return () => {
      if (sessionId) {
        unsubscribe(sessionId);
      }
      removeEventListener("message" as any, handleWebSocketMessage);
    };
  }, [sessionId, addEventListener, removeEventListener, subscribe, unsubscribe, addMessage]);

  // 3️⃣ 無限滾動檢測（載入更舊的訊息，並維持捲動位置）
  useEffect(() => {
    const container = viewportRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop < 100 && canLoadMore("older") && !isLoadingMore) {
        const previousScrollHeight = container.scrollHeight;
        const previousScrollTop = container.scrollTop;

        loadMoreMessages("older").then(() => {
          requestAnimationFrame(() => {
            const scrollDiff = container.scrollHeight - previousScrollHeight;
            container.scrollTop = previousScrollTop + scrollDiff;
          });
        });
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [canLoadMore, loadMoreMessages, isLoadingMore]);

  // 4️⃣ 發送新訊息
  const handleSendMessage = useCallback(
    async (messageContent: string) => {
      if (!messageContent.trim() || !isSessionActive) {
        return;
      }

      // 樂觀更新：立即顯示用戶訊息
      const tempMessage: Message = {
        messageId: `temp-${Date.now()}`,
        sessionId,
        type: "user",
        content: messageContent,
        timestamp: new Date(),
        metadata: { status: "sending" },
      };

      addMessage(tempMessage);

      try {
        // 發送訊息到後端，WebSocket 會推送正式的訊息
        await sessionApi.sendMessage(sessionId, messageContent);

        // 立即更新 session 的 lastUserMessage 和 messageCount
        if (onSessionUpdate) {
          console.log("=== ChatInterface calling onSessionUpdate ===", {
            lastUserMessage: messageContent,
            messageCount: (session?.messageCount || 0) + 1,
          });
          onSessionUpdate({
            lastUserMessage: messageContent,
            messageCount: (session?.messageCount || 0) + 1,
          });
        }

        // 成功後更新狀態
        updateMessageStatus(tempMessage.messageId, "sent");
      } catch (error) {
        toast.error(t('chat.sendFailed'));
        console.error("Error sending message:", error);
        // 標記為失敗
        updateMessageStatus(tempMessage.messageId, "failed");
        throw error;
      }
    },
    [sessionId, isSessionActive, onSessionUpdate, session?.messageCount, addMessage, updateMessageStatus, t]
  );

  // 5️⃣ assistant-ui runtime：我們自己持有狀態，只交給它渲染
  const runtime = useExternalStoreRuntime<ThreadMessageLike>({
    messages: threadMessages,
    convertMessage: (message) => message,
    isRunning: isProcessing,
    isDisabled: !isSessionActive,
    onNew: async (message: AppendMessage) => {
      const text = appendedText(message);
      if (text) await handleSendMessage(text);
    },
  });

  // 渲染
  if (isLoading && threadMessages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('chat.loadingHistory')}</p>
        </div>
      </div>
    );
  }

  if (error && threadMessages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{t('chat.loadMessagesFailed')}</p>
          <button onClick={() => initializeFromAPI(sessionId)} className="btn-primary">
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  const header = (
    <div className="glass border-b border-glass-border px-4 py-2">
      <div className="flex items-center justify-between">
        {!isSessionActive ? (
          <div className="flex items-center space-x-2 text-gray-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{t('chat.sessionStoppedNotice')}</span>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <MessageFilter hiddenTypes={hiddenMessageTypes} onFilterChange={handleFilterChange} />
      </div>
    </div>
  );

  const beforeMessages = (
    <>
      {canLoadMore("older") && (
        <div className="text-center py-4">
          {isLoadingMore ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-500">{t('chat.loadingMore')}</span>
            </div>
          ) : (
            <button onClick={() => loadMoreMessages("older")} className="text-sm text-primary-600 hover:text-primary-700 font-medium hover:underline">
              {t('chat.loadEarlier')}
            </button>
          )}
        </div>
      )}

      {filteredCount > 0 && threadMessages.length > 0 && (
        <div className="flex justify-center mb-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-warning-50 text-warning-700 text-sm rounded-full border border-warning-200">
            <span>{t('chat.hiddenCount', { count: filteredCount })}</span>
          </div>
        </div>
      )}
    </>
  );

  const empty = (
    <div className="text-center py-16">
      {filteredCount > 0 ? (
        <>
          <div className="bg-gradient-to-br from-warning-400 to-warning-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-soft-md">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('chat.noMessages')}</h3>
          <p className="text-gray-600">{t('chat.filteredHidden', { count: filteredCount })}</p>
          <p className="text-sm text-gray-500 mt-2">{t('chat.adjustFilterHint')}</p>
        </>
      ) : (
        <>
          <div className="bg-gradient-to-br from-success-400 to-success-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-soft-md animate-float">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('chat.startConversation')}</h3>
          <p className="text-gray-600">{t('chat.startHint')}</p>
        </>
      )}
    </div>
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread
        isSessionActive={isSessionActive}
        header={header}
        beforeMessages={beforeMessages}
        empty={empty}
        onViewportRef={(element) => {
          viewportRef.current = element;
        }}
      />
    </AssistantRuntimeProvider>
  );
};
