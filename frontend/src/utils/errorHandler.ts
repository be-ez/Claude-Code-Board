import { AxiosError } from 'axios';
import i18n from '../i18n';

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

/**
 * 從 Axios 錯誤中提取錯誤訊息
 * @param error - Axios 錯誤物件
 * @param defaultMessage - 預設錯誤訊息
 * @returns 錯誤訊息字串
 */
export const getErrorMessage = (error: unknown, defaultMessage = i18n.t('errors.generic')): string => {
  if (error instanceof AxiosError) {
    // 處理 API 回傳的錯誤
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    
    // 處理網路錯誤
    if (error.code === 'ECONNABORTED') {
      return i18n.t('errors.timeout');
    }
    
    if (error.code === 'ERR_NETWORK') {
      return i18n.t('errors.network');
    }
    
    // 處理 HTTP 狀態碼
    if (error.response?.status) {
      switch (error.response.status) {
        case 400:
          return i18n.t('errors.badRequest');
        case 401:
          return i18n.t('errors.unauthorized');
        case 403:
          return i18n.t('errors.forbidden');
        case 404:
          return i18n.t('errors.notFound');
        case 500:
          return i18n.t('errors.serverError');
        case 502:
        case 503:
          return i18n.t('errors.unavailable');
        default:
          return defaultMessage;
      }
    }
  }
  
  // 處理一般錯誤
  if (error instanceof Error) {
    return error.message;
  }
  
  return defaultMessage;
};