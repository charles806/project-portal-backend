import { Request, Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const session = await clerkClient.verifyToken(token);
    (req as any).userId = session.sub;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};