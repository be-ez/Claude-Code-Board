import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getEnvConfig } from '../config/env.config';
import { reqT } from '../i18n';

// 擴展 Request 介面以包含 user 屬性
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // 從 header 中獲取 token
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: reqT(req)('auth.noToken')
      });
    }

    // 驗證 token
    const jwtSecret = getEnvConfig().auth.jwtSecret;
    const decoded = jwt.verify(token, jwtSecret);
    
    // 將解碼後的用戶資訊附加到 request 物件
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: reqT(req)('auth.tokenExpired')
      });
    }
    
    return res.status(401).json({
      success: false,
      message: reqT(req)('auth.tokenInvalid')
    });
  }
};