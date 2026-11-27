import { Injectable, Logger } from '@nestjs/common';
import { seatsKey } from '../common/constants/redis-keys';
import { RedisService } from '../redis/redis.service';

export const SEAT_COUNTER_TTL_SECONDS = 600;

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * Redis available-seat counter per tier: a fast-path HINT only. Postgres decides every
 * booking; Redis just rejects obviously sold-out requests without a DB hit. Every method
 * is failure-tolerant: a Redis problem degrades to "no hint", never to a failed booking.
 */
@Injectable()
export class SeatCounterService {
  private readonly logger = new Logger(SeatCounterService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Available seats from Redis; on a miss, `loadFromDb` supplies the value and it is cached
   * with SET NX. Returns null when there is no usable hint (Redis down, tier unknown).
   */
  async getAvailableHint(
    tierId: string,
    loadFromDb: () => Promise<number | null>,
  ): Promise<number | null> {
    const key = seatsKey(tierId);

    let raw: string | null;
    try {
      raw = await this.redis.get(key);
    } catch (error) {
      this.logger.warn(`Seat hint read failed for ${tierId}: ${errMsg(error)}`);
      return null;
    }

    if (raw !== null) {
      const cached = Number(raw);
      if (Number.isInteger(cached)) return cached;
      await this.invalidate(tierId); // corrupt value: drop it and reload below
    }

    const fromDb = await loadFromDb();
    if (fromDb === null) return null;
    try {
      await this.redis.setIfAbsent(key, String(fromDb), SEAT_COUNTER_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`Seat hint warm-up failed for ${tierId}: ${errMsg(error)}`);
    }
    return fromDb;
  }

  /**
   * After a COMMIT: add `delta` (negative = seats taken, positive = released). Only touches
   * an existing key (Lua); a missing key is re-warmed from the DB on the next read. On a
   * Redis error the key is dropped so it re-syncs from the DB. Never throws.
   */
  async applyDelta(tierId: string, delta: number): Promise<void> {
    try {
      await this.redis.adjustIfExists(seatsKey(tierId), delta);
    } catch (error) {
      this.logger.error(`Seat counter update failed for ${tierId}, dropping key: ${errMsg(error)}`);
      await this.invalidate(tierId);
    }
  }

  /** Overwrites the hint with a value known from the DB (used when the hint was wrong). */
  async correct(tierId: string, available: number): Promise<void> {
    try {
      await this.redis.set(seatsKey(tierId), String(available), SEAT_COUNTER_TTL_SECONDS);
    } catch (error) {
      this.logger.warn(`Seat hint correction failed for ${tierId}: ${errMsg(error)}`);
    }
  }

  /** Drops the hint so the next read reloads from the DB (e.g. after a tier capacity edit). */
  async invalidate(tierId: string): Promise<void> {
    try {
      await this.redis.del(seatsKey(tierId));
    } catch (error) {
      this.logger.warn(`Seat hint invalidate failed for ${tierId}: ${errMsg(error)}`);
    }
  }
}