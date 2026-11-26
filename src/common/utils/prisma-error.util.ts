import { Prisma } from '../../../generated/prisma/client';

/**
 * Type guard for Prisma "known request" errors, matched by code.
 * P2002 = unique constraint violated, P2025 = record not found.
 */
export function isPrismaError(
  error: unknown,
  code: 'P2002' | 'P2025',
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}