import { Router, Request, Response } from 'express';
import { WebClient } from '@slack/web-api';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * GET /api/slack/connect
 * Generates Slack OAuth v2 authorize URL and redirects the user
 */
router.get('/connect', requireAuth, (req: Request, res: Response) => {
  const userId = req.user!.id;

  if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
    return res.status(500).json({
      error: 'Slack OAuth is not configured. Please set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in .env',
    });
  }

  const scopes = ['chat:write', 'channels:read'].join(',');
  const slackAuthUrl =
    `https://slack.com/oauth/v2/authorize?client_id=${encodeURIComponent(
      env.SLACK_CLIENT_ID
    )}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(
      env.SLACK_REDIRECT_URI
    )}&state=${encodeURIComponent(userId)}`;

  res.redirect(slackAuthUrl);
});

/**
 * GET /api/slack/callback
 * Handles Slack OAuth callback and stores token + channel
 */
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state: userId, error } = req.query as {
    code?: string;
    state?: string;
    error?: string;
  };

  if (error) {
    console.error('Slack OAuth error callback:', error);
    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error&message=${encodeURIComponent(error)}`);
  }

  if (!code || !userId) {
    return res.status(400).json({ error: 'Missing code or state parameter' });
  }

  try {
    const client = new WebClient();
    const response = await client.oauth.v2.access({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    });

    if (!response.ok || !response.access_token) {
      console.error('Failed to exchange Slack OAuth code:', response.error);
      return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=failed`);
    }

    const accessToken = response.access_token;
    const teamName = response.team?.name || null;
    let channelId: string | null = (response as any).incoming_webhook?.channel_id || null;

    // If channel wasn't bound in webhook, auto-discover first available public channel
    if (!channelId) {
      try {
        const authedClient = new WebClient(accessToken);
        const channelsRes = await authedClient.conversations.list({
          types: 'public_channel',
          limit: 20,
        });

        if (channelsRes.channels && channelsRes.channels.length > 0) {
          const general =
            channelsRes.channels.find((c) => c.name === 'general') ||
            channelsRes.channels[0];
          channelId = general.id || null;
        }
      } catch (channelErr: any) {
        console.warn('Could not auto-fetch Slack channel list:', channelErr.message);
      }
    }

    // Default fallback channel if none found
    if (!channelId) {
      channelId = 'general';
    }

    // Update user record with Slack connection details
    await prisma.user.update({
      where: { id: userId },
      data: {
        slackAccessToken: accessToken,
        slackChannel: channelId,
        slackTeamName: teamName,
      },
    });

    console.log(`🔗 Slack successfully connected for user ${userId} (Team: ${teamName}, Channel: ${channelId})`);

    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (err: any) {
    console.error('Slack OAuth exchange error:', err.message);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error`);
  }
});

/**
 * GET /api/slack/status
 * Check Slack connection status for the logged-in user
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        slackAccessToken: true,
        slackChannel: true,
        slackTeamName: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      connected: Boolean(user.slackAccessToken),
      channel: user.slackChannel,
      team: user.slackTeamName,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to check Slack status' });
  }
});

/**
 * POST /api/slack/disconnect
 * Disconnects Slack integration for the current user
 */
router.post('/disconnect', requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        slackAccessToken: null,
        slackChannel: null,
        slackTeamName: null,
      },
    });

    res.json({
      success: true,
      message: 'Slack disconnected successfully',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to disconnect Slack' });
  }
});

export default router;
