import type { Prisma } from '../../generated/prisma/client';

/**
 * Columns that are safe to expose over the API. Passing this to Prisma's
 * `select` means `passwordHash` is never read from the DB for these queries.
 */
export const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

/** A user as returned by the API (no passwordHash, no deletedAt). */
export type SafeUser = Prisma.UserGetPayload<{
  select: typeof SAFE_USER_SELECT;
}>;