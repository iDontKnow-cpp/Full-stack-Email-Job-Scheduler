import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { AuthUser } from '../types';

interface JwtPayload {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  if (req.cookies && req.cookies.jwt) {
    return req.cookies.jwt;
  }

  return null;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Fetch user from DB to ensure user exists and to populate current Slack info
    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (user) {
        req.user = {
          id: user.id,
          googleId: user.googleId,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          slackAccessToken: user.slackAccessToken,
          slackChannel: user.slackChannel,
          slackTeamName: user.slackTeamName,
        };
        next();
        return;
      }
    } catch (dbErr) {
      // If DB error happens, fall back to the valid JWT payload
      req.user = {
        id: decoded.id,
        googleId: '',
        email: decoded.email,
        name: decoded.name,
        avatar: decoded.avatar,
      };
      next();
      return;
    }

    res.status(401).json({ error: 'Unauthorized: User not found' });
  } catch (err: any) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (user) {
        req.user = {
          id: user.id,
          googleId: user.googleId,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          slackAccessToken: user.slackAccessToken,
          slackChannel: user.slackChannel,
          slackTeamName: user.slackTeamName,
        };
      } else {
        req.user = {
          id: decoded.id,
          googleId: '',
          email: decoded.email,
          name: decoded.name,
          avatar: decoded.avatar,
        };
      }
    } catch {
      req.user = {
        id: decoded.id,
        googleId: '',
        email: decoded.email,
        name: decoded.name,
        avatar: decoded.avatar,
      };
    }
  } catch {
    // Optional auth ignores invalid tokens
  }

  next();
}
