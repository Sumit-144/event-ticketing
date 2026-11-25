import { Injectable } from '@nestjs/common';
import type { RefreshToken } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateRefreshTokenData {
  tokenHash: string;
  familyId: string;
  userId: string;
  expiresAt: Date;
}

/** All DB access for refresh-token rows. Only SHA-256 hashes are stored, never raw tokens. */
@Injectable()
export class RefreshTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  /**
   * Atomically marks an unused, unexpired token as used.
   * Returns true for exactly one caller; concurrent callers get false.
   */
  async claim(tokenHash: string, now: Date): Promise<boolean> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    return count === 1;
  }

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  /** Revokes a whole login session: every token that shares the family. */
  async deleteFamily(familyId: string): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { familyId },
    });
    return count;
  }
}