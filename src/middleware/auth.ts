import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';

// Augment Express's Request type globally so req.user has our custom shape
declare global {
  namespace Express {
    interface User {
      userId: string;
      email: string;
      username?: string;
    }
  }
}

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    username?: string;
  };
}

export async function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.cookies?.accessToken || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}