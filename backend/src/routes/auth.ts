import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

const oauth2Client = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_CALLBACK_URL
);

/**
 * GET /api/auth/google
 * Redirects user to Google OAuth consent screen
 */
router.get('/google', (req: Request, res: Response) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    // If running in development without credentials, provide informative error
    return res.status(500).json({
      error: 'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env',
    });
  }

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'openid',
    ],
    prompt: 'select_account',
    redirect_uri: env.GOOGLE_CALLBACK_URL,
  });

  res.redirect(authUrl);
});

/**
 * GET /api/auth/google/callback
 * Handles OAuth callback from Google
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const error = req.query.error as string;
  if (error) {
    console.error('Google OAuth error callback:', error);
    return res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  try {
    const { tokens } = await oauth2Client.getToken({
      code,
      redirect_uri: env.GOOGLE_CALLBACK_URL,
    });
    oauth2Client.setCredentials(tokens);

    let googleId = '';
    let email = '';
    let name = '';
    let avatar: string | null = null;

    if (tokens.id_token) {
      try {
        const ticket = await oauth2Client.verifyIdToken({
          idToken: tokens.id_token,
          audience: env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (payload) {
          googleId = payload.sub;
          email = payload.email || '';
          name = payload.name || payload.email || 'User';
          avatar = payload.picture || null;
        }
      } catch (verifyErr: any) {
        console.warn('ID token verification skipped/failed, falling back to userinfo:', verifyErr.message);
      }
    }

    if (!email) {
      const userInfoResponse = await oauth2Client.request<any>({
        url: 'https://www.googleapis.com/oauth2/v3/userinfo',
      });
      googleId = userInfoResponse.data.sub;
      email = userInfoResponse.data.email;
      name = userInfoResponse.data.name || email;
      avatar = userInfoResponse.data.picture || null;
    }

    if (!email || !googleId) {
      return res.status(400).json({ error: 'Failed to retrieve Google account identity' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userByGoogleId = await prisma.user.findUnique({ where: { googleId } });
    const userByEmail = userByGoogleId
      ? null
      : await prisma.user.findFirst({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });

    const user = userByGoogleId
      ? await prisma.user.update({
          where: { id: userByGoogleId.id },
          data: { email: normalizedEmail, name, avatar },
        })
      : userByEmail
        ? await prisma.user.update({
            where: { id: userByEmail.id },
            data: { googleId, email: normalizedEmail, name, avatar },
          })
        : await prisma.user.upsert({
            where: { googleId },
            update: { email: normalizedEmail, name, avatar },
            create: {
              googleId,
              email: normalizedEmail,
              name,
              avatar,
            },
          });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const isHttps =
      req.secure ||
      req.headers['x-forwarded-proto'] === 'https' ||
      Boolean(req.headers['cf-visitor']?.includes('https')) ||
      Boolean(req.headers['cf-ray']) ||
      env.GOOGLE_CALLBACK_URL.startsWith('https://');

    // Set cookie with explicit root path and protocol-aware secure attribute
    res.cookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Check if client expects JSON (e.g. testing) or browser redirect
    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('application/json')) {
      return res.json({ token, user });
    }

    return res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (err: any) {
    console.error('❌ Error handling Google OAuth callback:', err.message);
    return res.redirect(`${env.FRONTEND_URL}/login?error=authentication_failed`);
  }
});

/**
 * POST /api/auth/dev-login
 * Development-only endpoint to log in or create a test user
 */
router.post('/dev-login', async (req: Request, res: Response) => {
  if (env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Dev login not permitted in production' });
  }

  const { email = 'demo@reachinbox.ai', name = 'Demo User' } = req.body || {};
  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: { name },
      create: {
        googleId: `dev_${Date.now()}`,
        email: normalizedEmail,
        name,
        avatar: 'https://lh3.googleusercontent.com/a/default-user',
      },
    });

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ token, user });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        slackChannel: true,
        slackTeamName: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      ...user,
      slackConnected: Boolean(user.slackChannel),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/logout
 * Clears JWT auth cookie across both HTTP and HTTPS / Tunnel environments
 */
router.post('/logout', (req: Request, res: Response) => {
  // Clear Secure version (used in production / Cloudflare tunnel / HTTPS)
  res.clearCookie('token', {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });

  // Clear non-Secure version (used in local development / direct HTTP)
  res.clearCookie('token', {
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
  });

  // Clear fallback jwt cookie
  res.clearCookie('jwt', {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });
  res.clearCookie('jwt', {
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
  });

  if (req.session) {
    req.session.destroy(() => {});
  }

  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
