import { io, Socket } from 'socket.io-client';
import { config } from '../config/env';

export interface WebSocketMessage {
  sessionId: string;
  type: 'message' | 'output' | 'status' | 'error' | 'assistant' | 'user' | 'system' | 'tool_use' | 'thinking' | 'claude';
  content: string;
  timestamp: Date;
  messageId?: string;
  metadata?: {
    // 工具使用相關
    toolName?: string;
    toolInput?: any;
    toolOutput?: any;
    toolStatus?: 'start' | 'complete' | 'error';
    
    // 思考過程
    isThinking?: boolean;
    thinkingDepth?: number;
    
    // 檔案操作
    fileOperation?: 'read' | 'write' | 'edit' | 'delete';
    filePath?: string;
    fileContent?: string;
    lineNumbers?: { start: number; end: number };
    
    // 串流相關
    isPartial?: boolean;
    sequenceId?: string;
    isComplete?: boolean;
    
    // 原始資料
    raw?: any;
  };
}

export interface WebSocketError {
  sessionId: string;
  error: string;
  errorType?: string;
  details?: {
    originalError?: string;
    stderr?: string;
    exitCode?: number | string;
    command?: string;
  };
  timestamp: Date;
}

export interface WebSocketEvents {
  // 收到的事件
  message: (data: WebSocketMessage) => void;
  output: (data: WebSocketMessage) => void;
  assistant: (data: WebSocketMessage) => void;
  user: (data: WebSocketMessage) => void;
  system: (data: WebSocketMessage) => void;
  tool_use: (data: WebSocketMessage) => void;
  thinking: (data: WebSocketMessage) => void;
  error: (data: WebSocketError) => void;
  status_update: (data: { sessionId: string; status: string }) => void;
  global_status_update: (data: { sessionId: string; status: string }) => void;
  session_updated: (data: { sessionId: string; lastUserMessage?: string; messageCount?: number; updatedAt?: string }) => void;
  process_started: (data: { sessionId: string; pid: number }) => void;
  process_exit: (data: { sessionId: string; code: number | null; signal: string | null }) => void;
  global_process_exit: (data: { sessionId: string; code: number | null; signal: string | null }) => void;
  connect: () => void;
  disconnect: () => void;
  connect_error: (error: Error) => void;
  
  // 發送的事件
  subscribe: (sessionId: string) => void;
  unsubscribe: (sessionId: string) => void;
}

class WebSocketService {
  private socket: Socket | null = null;
  private subscribers: Set<string> = new Set();
  private eventListeners: Map<string, Set<Function>> = new Map();
  private isConnecting: boolean = false;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 如果已經連接，直接返回
      if (this.socket?.connected) {
        resolve();
        return;
      }

      // 如果正在連接中，等待連接完成
      if (this.isConnecting) {
        const checkConnection = () => {
          if (this.socket?.connected) {
            resolve();
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
        return;
      }

      // 清理舊的連接
      if (this.socket) {
        this.socket.disconnect();
      }

      this.isConnecting = true;
      // 在開發環境中，使用代理，所以連接到根路徑
      // 在生產環境中，直接連接到 WebSocket URL
      const wsUrl = config.NODE_ENV === 'development' ? '/' : config.WS_URL;
      this.socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
      });

      this.socket.on('connect', () => {
        console.log('WebSocket connected:', this.socket?.id);
        this.isConnecting = false;
        
        // 重新訂閱之前的 sessions
        this.subscribers.forEach(sessionId => {
          this.socket?.emit('subscribe', sessionId);
        });
        
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        this.isConnecting = false;
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        this.isConnecting = false;
        this.notifyListeners('disconnect');
      });

      // 設定事件監聽器
      this.setupEventListeners();
    });
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // 安全轉換時間戳的函數
    const safeTimestamp = (timestamp: any): Date => {
      try {
        if (!timestamp) return new Date();
        if (timestamp instanceof Date) return timestamp;
        const date = new Date(timestamp);
        return isNaN(date.getTime()) ? new Date() : date;
      } catch (error) {
        console.warn('Invalid timestamp in WebSocket data:', timestamp, error);
        return new Date();
      }
    };

    // 處理通用 message 事件
    this.socket.on('message', (data) => {
      console.log('=== WebSocket received message event ===', data);
      
      // 檢查資料完整性
      if (!data || typeof data !== 'object') {
        console.warn('Invalid message data received:', data);
        return;
      }
      
      const messageData = {
        sessionId: data.sessionId || '',
        type: data.type || 'message',
        content: data.content || '',
        timestamp: safeTimestamp(data.timestamp),
        metadata: data.metadata
      };
      
      console.log('processed message data:', messageData);
      
      // 統一觸發 message 事件，不再根據 type 分發
      this.notifyListeners('message', messageData);
    });

    // 註釋掉特定類型的事件處理，避免重複
    // （因為後端同時發送 message 和特定類型事件，我們只需要處理 message）
    /*
    this.socket.on('assistant', (data) => {
      console.log('=== WebSocket 接收 assistant 事件 ===', data);
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid assistant data received:', data);
        return;
      }
      
      const messageData = {
        sessionId: data.sessionId || '',
        type: 'assistant' as const,
        content: data.content || '',
        timestamp: safeTimestamp(data.timestamp),
        metadata: data.metadata
      };
      
      console.log('處理後的 assistant 資料:', messageData);
      this.notifyListeners('assistant', messageData);
    });
    */

    /*
    this.socket.on('user', (data) => {
      console.log('=== WebSocket 接收 user 事件 ===', data);
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid user data received:', data);
        return;
      }
      
      const messageData = {
        sessionId: data.sessionId || '',
        type: 'user' as const,
        content: data.content || '',
        timestamp: safeTimestamp(data.timestamp),
        metadata: data.metadata
      };
      
      console.log('處理後的 user 資料:', messageData);
      this.notifyListeners('user', messageData);
    });
    */

    /*
    this.socket.on('system', (data) => {
      console.log('=== WebSocket 接收 system 事件 ===', data);
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid system data received:', data);
        return;
      }
      
      const messageData = {
        sessionId: data.sessionId || '',
        type: 'system' as const,
        content: data.content || '',
        timestamp: safeTimestamp(data.timestamp),
        metadata: data.metadata
      };
      
      console.log('處理後的 system 資料:', messageData);
      this.notifyListeners('system', messageData);
    });
    */

    // output 事件可能需要單獨處理，因為它可能不會通過 message 事件發送
    this.socket.on('output', (data) => {
      console.log('=== WebSocket received output event ===', data);
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid output data received:', data);
        return;
      }
      
      const messageData = {
        sessionId: data.sessionId || '',
        type: 'output' as const,
        content: data.content || '',
        timestamp: safeTimestamp(data.timestamp),
        metadata: data.metadata
      };
      
      console.log('processed output data:', messageData);
      // 統一觸發 message 事件
      this.notifyListeners('message', messageData);
    });

    /*
    this.socket.on('tool_use', (data) => {
      console.log('=== WebSocket 接收 tool_use 事件 ===', data);
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid tool_use data received:', data);
        return;
      }
      
      const messageData = {
        sessionId: data.sessionId || '',
        type: 'tool_use' as const,
        content: data.content || '',
        timestamp: safeTimestamp(data.timestamp),
        metadata: data.metadata
      };
      
      console.log('處理後的 tool_use 資料:', messageData);
      this.notifyListeners('tool_use', messageData);
    });
    */

    /*
    this.socket.on('thinking', (data) => {
      console.log('=== WebSocket 接收 thinking 事件 ===', data);
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid thinking data received:', data);
        return;
      }
      
      const messageData = {
        sessionId: data.sessionId || '',
        type: 'thinking' as const,
        content: data.content || '',
        timestamp: safeTimestamp(data.timestamp),
        metadata: data.metadata
      };
      
      console.log('處理後的 thinking 資料:', messageData);
      this.notifyListeners('thinking', messageData);
    });
    */

    this.socket.on('status_update', (data) => {
      console.log('=== WebSocket received status_update event ===', data);
      this.notifyListeners('status_update', data);
    });

    this.socket.on('global_status_update', (data) => {
      this.notifyListeners('global_status_update', data);
    });

    this.socket.on('session_updated', (data) => {
      console.log('=== WebSocket received session_updated event ===', data);
      this.notifyListeners('session_updated', data);
    });

    this.socket.on('process_started', (data) => {
      this.notifyListeners('process_started', data);
    });

    this.socket.on('process_exit', (data) => {
      this.notifyListeners('process_exit', data);
    });

    this.socket.on('global_process_exit', (data) => {
      this.notifyListeners('global_process_exit', data);
    });

    // 處理錯誤事件
    this.socket.on('error', (data) => {
      console.log('=== WebSocket received error event ===', data);
      
      if (!data || typeof data !== 'object') {
        console.warn('Invalid error data received:', data);
        return;
      }
      
      const errorData = {
        sessionId: data.sessionId || '',
        error: data.error || 'Unknown error',
        errorType: data.errorType,
        details: data.details,
        timestamp: safeTimestamp(data.timestamp)
      };
      
      console.log('processed error data:', errorData);
      this.notifyListeners('error', errorData);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.subscribers.clear();
      this.isConnecting = false;
    }
  }

  subscribe(sessionId: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot subscribe: WebSocket not connected');
      return;
    }

    this.subscribers.add(sessionId);
    this.socket.emit('subscribe', sessionId);
    console.log(`Subscribed to session: ${sessionId}`);
  }

  unsubscribe(sessionId: string): void {
    if (!this.socket?.connected) {
      console.warn('Cannot unsubscribe: WebSocket not connected');
      return;
    }

    this.subscribers.delete(sessionId);
    this.socket.emit('unsubscribe', sessionId);
    console.log(`Unsubscribed from session: ${sessionId}`);
  }

  on<T extends keyof WebSocketEvents>(event: T, callback: WebSocketEvents[T]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  off<T extends keyof WebSocketEvents>(event: T, callback: WebSocketEvents[T]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  private notifyListeners(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in WebSocket event listener for ${event}:`, error);
        }
      });
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

// 單例模式
export const websocketService = new WebSocketService();
export default websocketService;