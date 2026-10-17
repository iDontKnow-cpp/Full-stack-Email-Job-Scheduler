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

  // Check if request is HTTPS via standard, proxy, or Cloudflare headers
  const forwardedProto = req.headers['x-forwarded-proto'] as string | undefined;
  const cfVisitor = req.headers['cf-visitor'] as string | undefined;

  let isHttps = req.secure || forwardedProto === 'https';
  if (cfVisitor) {
    try {
      const parsed = JSON.parse(cfVisitor);
      if (parsed.scheme === 'https') isHttps = true;
    } catch {}
  }

  // Cloudflare tunnels are always accessed over HTTPS externally
  if (
    host &&
    (host.includes('trycloudflare.com') ||
      host.includes('cloudflare.com') ||
      req.headers['cf-ray'])
  ) {
    isHttps = true;
  }

  const proto = isHttps ? 'https' : (forwardedProto || req.protocol || 'http');

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

