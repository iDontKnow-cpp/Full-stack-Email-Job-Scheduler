import { redis } from '../lib/redis';
import { RateLimitCheckResult } from '../types';

export function getHourWindow(date: Date = new Date()): number {
  return Math.floor(date.getTime() / 3600000);
}

export function getNextHourWindowDate(date: Date = new Date()): Date {
  const currentHour = getHourWindow(date);
  return new Date((currentHour + 1) * 3600000);
}

export function getRateLimitKey(senderEmail: string, hourWindow?: number): string {
  const window = hourWindow ?? getHourWindow();
  return `ratelimit:${senderEmail.trim().toLowerCase()}:${window}`;
}

/**
 * Checks and increments the hourly rate limit counter for a given sender.
 * If within limit, increments and returns allowed = true.
 * If limit is reached or exceeded, does not increment and returns allowed = false.
 */
export async function checkRateLimit(
  senderEmail: string,
  hourlyLimit: number
): Promise<RateLimitCheckResult> {
  const hourWindow = getHourWindow();
  const key = getRateLimitKey(senderEmail, hourWindow);
  const resetAt = getNextHourWindowDate();

  // Atomically get current count and increment if within limit
  const luaScript = `
    local current = redis.call('GET', KEYS[1])
    if current and tonumber(current) >= tonumber(ARGV[1]) then
      return {0, tonumber(current)}
    end
    local newVal = redis.call('INCR', KEYS[1])
    if newVal == 1 then
      redis.call('EXPIRE', KEYS[1], ARGV[2])
    end
    return {1, newVal}
  `;

  // Calculate TTL until the end of the hour window (with a minimum of 60 seconds)
  const secondsLeftInHour = Math.max(
    Math.ceil((resetAt.getTime() - Date.now()) / 1000) + 60,
    3600
  );

  try {
    const result = (await redis.eval(
      luaScript,
      1,
      key,
      hourlyLimit.toString(),
      secondsLeftInHour.toString()
    )) as [number, number];

    const allowed = result[0] === 1;
    const currentCount = Number(result[1]);
    const remaining = Math.max(0, hourlyLimit - currentCount);

    return {
      allowed,
      remaining,
      currentCount,
      resetAt,
    };
  } catch (err: any) {
    console.error(`Error in checkRateLimit for ${senderEmail}:`, err.message);
    // Fallback in case of redis eval issue: fallback to simple INCR
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 3600);
    }
    const allowed = count <= hourlyLimit;
    return {
      allowed,
      remaining: Math.max(0, hourlyLimit - count),
      currentCount: count,
      resetAt,
    };
  }
}

/**
 * Get current rate limit usage without consuming a token.
 */
export async function getRateLimitInfo(
  senderEmail: string,
  hourlyLimit: number
): Promise<RateLimitCheckResult> {
  const hourWindow = getHourWindow();
  const key = getRateLimitKey(senderEmail, hourWindow);
  const resetAt = getNextHourWindowDate();

  try {
    const currentStr = await redis.get(key);
    const currentCount = currentStr ? parseInt(currentStr, 10) : 0;
    const allowed = currentCount < hourlyLimit;
    const remaining = Math.max(0, hourlyLimit - currentCount);

    return {
      allowed,
      remaining,
      currentCount,
      resetAt,
    };
  } catch (err: any) {
    console.error(`Error in getRateLimitInfo for ${senderEmail}:`, err.message);
    return {
      allowed: true,
      remaining: hourlyLimit,
      currentCount: 0,
      resetAt,
    };
  }
}
