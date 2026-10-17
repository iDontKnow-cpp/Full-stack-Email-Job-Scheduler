import { Request } from 'express';
import { env } from '../config/env';

/**
 * Dynamically resolves the base URL of the incoming request.
 * Handles Cloudflare Tunnels, Nginx reverse proxy headers (X-Forwarded-Host/Proto),
 * and falls back to configured FRONTEND_URL.
 */
export function getBaseUrl(req: Request): string {
  const forwardedHost = req.headers['x-forwarded-host'] as string | undefined;
  const host = forwardedHost || req.get('host');

  const forwardedProto = req.headers['x-forwarded-proto'] as string | undefined;
  const proto = forwardedProto || (req.secure ? 'https' : req.protocol) || 'http';

  if (
    host &&
    !host.includes('backend-service') &&
    !host.includes('frontend-service') &&
    !host.includes('localhost:3001')
  ) {
    return `${proto}://${host}`;
  }

  return env.FRONTEND_URL;
}

