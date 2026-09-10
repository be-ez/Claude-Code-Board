import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SessionStatus, ProcessStatus } from '../types/session.types';
import i18n from '../i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 格式化日期時間
export function formatDateTime(date: Date | string | number): string {
  try {
    let validDate: Date;
    
    if (date instanceof Date) {
      validDate = date;
    } else {
      validDate = new Date(date);
    }
    
    // 檢查是否為有效日期
    if (isNaN(validDate.getTime())) {
      console.warn('Invalid date provided to formatDateTime:', date);
      return i18n.t('time.invalid');
    }
    
    return new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(validDate);
  } catch (error) {
    console.warn('Error formatting date:', date, error);
    return i18n.t('time.invalid');
  }
}

// 格式化相對時間
export function formatRelativeTime(date: Date | string | number): string {
  try {
    let validDate: Date;
    
    if (date instanceof Date) {
      validDate = date;
    } else {
      validDate = new Date(date);
    }
    
    // 檢查是否為有效日期
    if (isNaN(validDate.getTime())) {
      console.warn('Invalid date provided to formatRelativeTime:', date);
      return i18n.t('time.invalid');
    }
    
    const now = new Date();
    const diff = now.getTime() - validDate.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
      return i18n.t('time.justNow');
    } else if (minutes < 60) {
      return i18n.t('time.minutesAgo', { count: minutes });
    } else if (hours < 24) {
      return i18n.t('time.hoursAgo', { count: hours });
    } else if (days < 7) {
      return i18n.t('time.daysAgo', { count: days });
    } else {
      return formatDateTime(validDate);
    }
  } catch (error) {
    console.warn('Error formatting relative time:', date, error);
    return i18n.t('time.invalid');
  }
}

// 格式化持續時間
export function formatDuration(startTime: Date | string | number, endTime?: Date | string | number): string {
  try {
    let validStartTime: Date;
    let validEndTime: Date;
    
    if (startTime instanceof Date) {
      validStartTime = startTime;
    } else {
      validStartTime = new Date(startTime);
    }
    
    if (endTime) {
      if (endTime instanceof Date) {
        validEndTime = endTime;
      } else {
        validEndTime = new Date(endTime);
      }
    } else {
      validEndTime = new Date();
    }
    
    // 檢查是否為有效日期
    if (isNaN(validStartTime.getTime()) || isNaN(validEndTime.getTime())) {
      console.warn('Invalid date provided to formatDuration:', startTime, endTime);
      return i18n.t('time.invalidDuration');
    }
    
    const diff = validEndTime.getTime() - validStartTime.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else if (minutes > 0) {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else {
      return `${seconds}s`;
    }
  } catch (error) {
    console.warn('Error formatting duration:', startTime, endTime, error);
    return i18n.t('time.invalidDuration');
  }
}

// 獲取狀態顏色
export function getStatusColor(status: SessionStatus | ProcessStatus): string {
  switch (status) {
    case SessionStatus.PROCESSING:
      return 'text-yellow-600 bg-yellow-100';
    case SessionStatus.IDLE:
    case ProcessStatus.IDLE:
      return 'text-green-600 bg-green-100';
    case SessionStatus.COMPLETED:
    case SessionStatus.INTERRUPTED:
    case ProcessStatus.STOPPED:
      return 'text-blue-600 bg-blue-100';
    case SessionStatus.ERROR:
    case ProcessStatus.ERROR:
    case ProcessStatus.CRASHED:
      return 'text-red-600 bg-red-100';
    case ProcessStatus.RUNNING:
    case ProcessStatus.BUSY:
      return 'text-yellow-600 bg-yellow-100';
    case ProcessStatus.STARTING:
    case ProcessStatus.STOPPING:
      return 'text-gray-600 bg-gray-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

// 獲取 Session 分類
export type SessionCategory = 'processing' | 'idle' | 'completed';

export function getSessionCategory(status: SessionStatus): SessionCategory {
  switch (status) {
    case SessionStatus.PROCESSING:
      return 'processing';
    case SessionStatus.IDLE:
      return 'idle';
    case SessionStatus.COMPLETED:
    case SessionStatus.ERROR:
    case SessionStatus.INTERRUPTED:
      return 'completed';
    default:
      return 'completed';
  }
}

// 獲取狀態文字
export function getStatusText(status: SessionStatus | ProcessStatus): string {
  switch (status) {
    case SessionStatus.PROCESSING:
      return i18n.t('sessionList.processing');
    case SessionStatus.IDLE:
      return i18n.t('sessionList.idle');
    case SessionStatus.COMPLETED:
      return i18n.t('common.completed');
    case SessionStatus.ERROR:
      return i18n.t('processStatus.error');
    case SessionStatus.INTERRUPTED:
      return i18n.t('notify.interrupted');
    case ProcessStatus.STARTING:
      return i18n.t('processStatus.starting');
    case ProcessStatus.RUNNING:
      return i18n.t('processStatus.running');
    case ProcessStatus.IDLE:
      return i18n.t('sessionList.idle');
    case ProcessStatus.BUSY:
      return i18n.t('processStatus.busy');
    case ProcessStatus.STOPPING:
      return i18n.t('processStatus.stopping');
    case ProcessStatus.STOPPED:
      return i18n.t('processStatus.stopped');
    case ProcessStatus.ERROR:
      return i18n.t('processStatus.error');
    case ProcessStatus.CRASHED:
      return i18n.t('processStatus.crashed');
    default:
      return i18n.t('common.unknown');
  }
}

// 格式化檔案大小
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

// 截斷文字
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}

// 生成隨機 ID
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// 延遲函數
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 防抖函數
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
}

// 節流函數
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}