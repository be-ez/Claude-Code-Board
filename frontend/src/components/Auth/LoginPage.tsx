import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, AlertCircle, Eye, EyeOff, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import axiosInstance from '../../utils/axiosInstance';
import { getErrorMessage } from '../../utils/errorHandler';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus username input on mount for better UX
    if (usernameInputRef.current) {
      usernameInputRef.current.focus();
    }
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  // 驗證使用者名稱
  const validateUsername = useCallback((value: string) => {
    if (!value) {
      setUsernameError(t('auth.usernameRequired'));
      return false;
    }
    if (value.length < 3) {
      setUsernameError(t('auth.usernameTooShort'));
      return false;
    }
    if (value.length > 20) {
      setUsernameError(t('auth.usernameTooLong'));
      return false;
    }
    setUsernameError('');
    return true;
  }, []);

  // 驗證密碼
  const validatePassword = useCallback((value: string) => {
    if (!value) {
      setPasswordError(t('auth.passwordRequired'));
      return false;
    }
    setPasswordError('');
    return true;
  }, []);

  // 處理使用者名稱變更
  const handleUsernameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    if (value || usernameError) {
      validateUsername(value);
    }
  }, [usernameError, validateUsername]);

  // 處理密碼變更
  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (value || passwordError) {
      validatePassword(value);
    }
  }, [passwordError, validatePassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // 驗證所有欄位
    const isUsernameValid = validateUsername(username);
    const isPasswordValid = validatePassword(password);
    
    if (!isUsernameValid || !isPasswordValid) {
      return;
    }
    
    setLoading(true);

    try {
      const response = await axiosInstance.post('/auth/login', {
        username,
        password
      });

      if (response.data.success) {
        // 儲存 token 到 localStorage
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('tokenExpiry', String(Date.now() + response.data.expiresIn));
        
        // 如果勾選記住我，儲存使用者名稱
        if (rememberMe) {
          localStorage.setItem('rememberedUsername', username);
        } else {
          localStorage.removeItem('rememberedUsername');
        }
        
        // 通知 AuthContext 更新認證狀態
        await checkAuth();
        
        toast.success(t('auth.loginSuccess'));
        navigate('/sessions');
      }
    } catch (error) {
      const message = getErrorMessage(error, t('auth.loginFailed'));
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // 載入記住的使用者名稱
  useEffect(() => {
    const rememberedUsername = localStorage.getItem('rememberedUsername');
    if (rememberedUsername) {
      setUsername(rememberedUsername);
      setRememberMe(true);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* 背景裝飾元素 - 優化動畫效能 */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-600/20 rounded-full blur-3xl animate-[pulse_4s_ease-in-out_infinite]"
          style={{ 
            willChange: 'transform',
            transform: 'translate3d(0, 0, 0)' // 啟用硬體加速
          }}
        />
      </div>
      
      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* 登入卡片 - 改善視覺效果和微交互 */}
        <div 
          className="bg-white/80 backdrop-blur-lg shadow-2xl rounded-2xl border border-white/20 p-8 transition-all duration-300 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] animate-fade-in"
        >

          <div className="relative z-10">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform duration-300 hover:scale-105 hover:shadow-indigo-500/25">
                <img 
                  src="/asset/logo.png" 
                  alt="Claude Logo" 
                  className="w-12 h-12 filter brightness-0 invert"
                />
              </div>
            </div>
            <h2 className="mt-6 text-center text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Claude Code Board
            </h2>
            <p className="mt-3 text-center text-sm text-gray-700">
              {t('auth.subtitle')}
            </p>
          </div>
          
          <form 
            ref={formRef}
            className="mt-8 space-y-6" 
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.username')}
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <User className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    ref={usernameInputRef}
                    value={username}
                    onChange={handleUsernameChange}
                    onBlur={() => username && validateUsername(username)}
                    className={`block w-full pl-12 pr-4 py-3 border ${
                      usernameError ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
                    } rounded-xl text-gray-900 placeholder-gray-500 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 hover:bg-white/70 focus:bg-white/80`}
                    placeholder={t('auth.usernamePlaceholder')}
                    aria-invalid={!!usernameError}
                    aria-describedby={usernameError ? "username-error" : error ? "login-error" : undefined}
                    aria-label={t('auth.username')}
                  />
                </div>
                {usernameError && (
                  <p id="username-error" className="mt-2 text-sm text-red-600 flex items-center" role="alert">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {usernameError}
                  </p>
                )}
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  {t('auth.password')}
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors duration-200" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={handlePasswordChange}
                    onBlur={() => password && validatePassword(password)}
                    className={`block w-full pl-12 pr-12 py-3 border ${
                      passwordError ? 'border-red-300 bg-red-50/30' : 'border-gray-200'
                    } rounded-xl text-gray-900 placeholder-gray-500 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 hover:bg-white/70 focus:bg-white/80`}
                    placeholder={t('auth.passwordPlaceholder')}
                    aria-invalid={!!passwordError}
                    aria-describedby={passwordError ? "password-error" : error ? "login-error" : undefined}
                    aria-label={t('auth.password')}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center z-10 text-gray-400 hover:text-blue-500 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500/20 rounded-lg h-[44px] w-[44px] -mr-3 justify-end"
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {passwordError && (
                  <p id="password-error" className="mt-2 text-sm text-red-600 flex items-center" role="alert">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    {passwordError}
                  </p>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-4 focus:ring-blue-500/20 border-gray-300 rounded cursor-pointer"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700 cursor-pointer select-none">
                    {t('auth.rememberMe')}
                  </label>
                </div>
                
                <a href="#" className="text-sm text-blue-600 hover:text-blue-800 hover:underline focus:outline-none focus:ring-4 focus:ring-blue-500/20 rounded px-2 py-1 -mx-2 -my-1">
                  {t('auth.forgotPassword')}
                </a>
              </div>
            </div>

            {error && (
              <div 
                id="login-error"
                className="rounded-xl bg-red-50/80 backdrop-blur-sm border border-red-200 p-4 animate-[slideInUp_0.3s_ease-out]"
                role="alert"
                aria-live="polite"
              >
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !!usernameError || !!passwordError}
                className={`group relative w-full flex justify-center items-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white transition-all duration-300 transform min-h-[44px] ${
                  loading || !!usernameError || !!passwordError
                    ? 'bg-gray-400 cursor-not-allowed scale-95' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-500/20'
                }`}
                aria-label={loading ? t('auth.signingInWait') : t('auth.signIn')}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('auth.signingIn')}
                  </span>
                ) : (
                  <span className="flex items-center">
                    {t('auth.login')}
                    <ArrowRight className="ml-2 -mr-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};