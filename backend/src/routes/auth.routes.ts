import express from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { getEnvConfig } from '../config/env.config';
import { reqT } from '../i18n';

const router = express.Router();

// 登入 API
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    // 從統一配置獲取帳號密碼
    const config = getEnvConfig();
    const adminUsername = config.auth.username;
    const adminPassword = config.auth.password;
    const jwtSecret = config.auth.jwtSecret;

    // 驗證帳號密碼
    if (username !== adminUsername || password !== adminPassword) {
      return res.status(401).json({
        success: false,
        message: reqT(req)('auth.badCredentials')
      });
    }

    // 生成 JWT token（7天有效期）
    const token = jwt.sign(
      { username, timestamp: Date.now() },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      expiresIn: 7 * 24 * 60 * 60 * 1000, // 7天的毫秒數
      message: reqT(req)('auth.loginSuccess')
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: reqT(req)('auth.loginError')
    });
  }
});

// 驗證 token API（用於檢查 token 是否有效）
router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: reqT(req)('auth.noToken')
    });
  }

  try {
    const jwtSecret = getEnvConfig().auth.jwtSecret;
    const decoded = jwt.verify(token, jwtSecret);
    
    res.json({
      success: true,
      message: reqT(req)('auth.tokenValid'),
      decoded
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: reqT(req)('auth.tokenInvalidOrExpired')
    });
  }
});

export default router;