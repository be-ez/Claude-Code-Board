import type { Request } from 'express';

export const SUPPORTED_LANGUAGES = ['en', 'zh-TW'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/**
 * User-facing strings returned by the API. Everything else the backend
 * prints (logs, warnings) stays English — only text that reaches a browser
 * is translated here.
 */
const MESSAGES: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    'auth.noToken': 'No authentication token provided',
    'auth.tokenExpired': 'Your session has expired, please sign in again',
    'auth.tokenInvalid': 'Invalid token',
    'auth.tokenInvalidOrExpired': 'Token is invalid or has expired',
    'auth.tokenValid': 'Token is valid',
    'auth.badCredentials': 'Incorrect username or password',
    'auth.loginSuccess': 'Signed in successfully',
    'auth.loginError': 'An error occurred while signing in',
    'session.taskCompleted': 'Task finished: {{name}}',
    'session.runFailed': 'Session failed (code: {{code}})',
  },
  'zh-TW': {
    'auth.noToken': '未提供認證 token',
    'auth.tokenExpired': 'Token 已過期，請重新登入',
    'auth.tokenInvalid': 'Token 無效',
    'auth.tokenInvalidOrExpired': 'Token 無效或已過期',
    'auth.tokenValid': 'Token 有效',
    'auth.badCredentials': '帳號或密碼錯誤',
    'auth.loginSuccess': '登入成功',
    'auth.loginError': '登入時發生錯誤',
    'session.taskCompleted': '任務執行完成：{{name}}',
    'session.runFailed': 'Session 執行失敗 (代碼: {{code}})',
  },
};

const isSupported = (lng: string): lng is SupportedLanguage =>
  (SUPPORTED_LANGUAGES as readonly string[]).includes(lng);

/**
 * Pick the best language from an Accept-Language header. Any Traditional
 * Chinese variant (zh, zh-Hant, zh-HK) maps onto the zh-TW catalogue.
 */
export const resolveLanguage = (header?: string): SupportedLanguage => {
  if (!header) return DEFAULT_LANGUAGE;
  const tags = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: tag.trim(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of tags) {
    if (isSupported(tag)) return tag;
    if (tag.toLowerCase().startsWith('zh')) return 'zh-TW';
    if (tag.toLowerCase().startsWith('en')) return 'en';
  }
  return DEFAULT_LANGUAGE;
};

/** Language requested by an incoming HTTP request. */
export const requestLanguage = (req: Request): SupportedLanguage =>
  resolveLanguage(req.headers['accept-language']);

export const t = (
  key: string,
  lang: SupportedLanguage = DEFAULT_LANGUAGE,
  vars?: Record<string, string | number>
): string => {
  const template = MESSAGES[lang]?.[key] ?? MESSAGES[DEFAULT_LANGUAGE][key] ?? key;
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_m, name) => String(vars[name] ?? ''));
};

/** Convenience for request handlers: `const tr = reqT(req)`. */
export const reqT =
  (req: Request) =>
  (key: string, vars?: Record<string, string | number>): string =>
    t(key, requestLanguage(req), vars);
