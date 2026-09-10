import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import i18n from '../i18n';

// 創建 axios instance
const axiosInstance: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 3600000, // 1小時超時
  headers: {
    'Content-Type': 'application/json',
  },
});

// 請求攔截器
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 從 localStorage 獲取 token
    const token = localStorage.getItem('token');
    const tokenExpiry = localStorage.getItem('tokenExpiry');
    
    // 檢查 token 是否過期
    if (token && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Let the backend answer in whatever language the UI is showing.
    config.headers['Accept-Language'] = i18n.resolvedLanguage ?? 'en';

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// 響應攔截器
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    // 處理 401 錯誤
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      // 清除本地儲存的認證資訊
      localStorage.removeItem('token');
      localStorage.removeItem('tokenExpiry');
      
      // 重定向到登入頁面
      window.location.href = '/login';
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;