import { CACHE_TTL } from "./constants.js";
import { logger } from "./logger.js";

const memoryCache = new Map();

function getNow() {
  return Date.now();
}

function isExpired(entry) {
  if (!entry || typeof entry.timestamp !== "number") {
    return true;
  }

  return getNow() - entry.timestamp > CACHE_TTL;
}

async function getRedisCache(key) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return null;
  }

  try {
    const response = await fetch(`${redisUrl}/get/${encodeURIComponent(key)}`, {
      headers: {
        Authorization: `Bearer ${redisToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      logger.warn("Upstash cache read failed.", response.status);
      return null;
    }

    const payload = await response.json();

    if (!payload?.result) {
      return null;
    }

    const parsed = JSON.parse(payload.result);

    if (isExpired(parsed)) {
      return null;
    }

    memoryCache.set(key, parsed);
    return parsed.data;
  } catch (error) {
    logger.warn("Upstash cache read threw an error.", error);
    return null;
  }
}

async function setRedisCache(key, entry) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    return;
  }

  try {
    const ttlSeconds = Math.floor(CACHE_TTL / 1000);

    await fetch(`${redisUrl}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        value: JSON.stringify(entry),
        ex: ttlSeconds,
      }),
      cache: "no-store",
    });
  } catch (error) {
    logger.warn("Upstash cache write threw an error.", error);
  }
}

export function clearExpired() {
  for (const [key, entry] of memoryCache.entries()) {
    if (isExpired(entry)) {
      memoryCache.delete(key);
    }
  }
}

export async function getCache(key) {
  clearExpired();

  const entry = memoryCache.get(key);

  if (entry) {
    if (isExpired(entry)) {
      memoryCache.delete(key);
      return null;
    }

    return entry.data;
  }

  return getRedisCache(key);
}

export async function setCache(key, data) {
  clearExpired();

  const entry = {
    data,
    timestamp: getNow(),
  };

  memoryCache.set(key, entry);
  await setRedisCache(key, entry);
}
