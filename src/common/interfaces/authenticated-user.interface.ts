import type { Role } from '../../../generated/prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  jti: string;
  exp: number; // unix seconds; logout uses it for the blacklist TTL
}