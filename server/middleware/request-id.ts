import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  (req as any).requestId = requestId;
  next();
}
