import { clerkMiddleware, requireAuth } from '@clerk/express';
import { Request, Response, NextFunction } from 'express';

// Apply Clerk middleware to all routes
export const authMiddleware = clerkMiddleware();

// Protect specific routes
export const requireAuthMiddleware = requireAuth();

// Extract user from Clerk session
export const getUserId = (req: Request): string | null => {
    return req.auth?.userId || null;
};