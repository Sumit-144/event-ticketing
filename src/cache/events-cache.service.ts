import { Injectable, Logger } from '@nestjs/common';
import {
  EVENT_LIST_VERSION_KEY,
  eventDetailKey,
} from '../common/constants/redis-keys';
import { RedisService } from '../redis/redis.service';

export const EVENTS_CACHE_TTL_SECONDS = 300;

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Cache policy for events in one place (D13). Reads fail open (Redis down = go to the DB);
 * invalidation failures are logged, never thrown, because the DB write already committed
 * and the TTL bounds staleness.
 */
@Injectable()
export class EventsCacheService {
  private readonly logger = new Logger(EventsCacheService.name);

  constructor(private readonly redis: RedisService) {}

  /** Current list version, or null when Redis is unavailable (caller skips the cache). */
  async getListVersion(): Promise<string | null> {
    try {
      return (await this.redis.get(EVENT_LIST_VERSION_KEY)) ?? '0';
    } catch (error) {
      this.logger.warn(`List version read failed: ${errMsg(error)}`);
      return null;
    }
  }

  /** INCR orphans every cached list at once; old keys die by TTL (D6). */
  async bumpListVersion(): Promise<void> {
    try {
      await this.redis.increment(EVENT_LIST_VERSION_KEY);
    } catch (error) {
      this.logger.error(`List version bump failed (lists stale up to TTL): ${errMsg(error)}`);
    }
  }

  async evictDetail(eventId: string): Promise<void> {
    try {
      await this.redis.del(eventDetailKey(eventId));
    } catch (error) {
      this.logger.error(`Detail evict failed for ${eventId}: ${errMsg(error)}`);
    }
  }

  /** Cache-aside: hit returns parsed JSON; miss runs `loader` and stores the result. */
  async remember<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = await this.read<T>(key);
    if (cached !== null) return cached;
    const fresh = await loader();
    await this.write(key, fresh);
    return fresh;
  }

  private async read<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch (error) {
      this.logger.warn(`Cache read failed for ${key}: ${errMsg(error)}`);
      return null;
    }
  }

  private async write(key: string, value: unknown): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), EVENTS_CACHE_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`Cache write failed for ${key}: ${errMsg(error)}`);
    }
  }
}