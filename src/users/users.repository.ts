import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, User } from '../../generated/prisma/client';
import { SAFE_USER_SELECT, SafeUser } from './users.types';

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  role?: Role;
}

export interface UpdateProfileData {
  name?: string;
  avatarUrl?: string;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Full row (includes passwordHash): auth internals only, never for API responses.
  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
  }

  create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({ data });
  }

  // ── API-facing queries: always use SAFE_USER_SELECT ──

  findSafeById(id: string): Promise<SafeUser | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: SAFE_USER_SELECT,
    });
  }

  /** Throws Prisma P2025 if the user does not exist or is soft-deleted. */
  updateProfile(id: string, data: UpdateProfileData): Promise<SafeUser> {
    return this.prisma.user.update({
      where: { id, deletedAt: null },
      data,
      select: SAFE_USER_SELECT,
    });
  }

  /** One round trip for the page and the total, consistent snapshot. */
  findManyPaginated(
    skip: number,
    take: number,
  ): Promise<[SafeUser[], number]> {
    const where = { deletedAt: null };
    return this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: SAFE_USER_SELECT,
        // `id` tiebreaker keeps pages stable when createdAt values collide.
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ]);
  }
}