import type { Role } from '../../../generated/prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  jti: string;
  iat?: number; // added by jsonwebtoken at sign time
  exp?: number; // added by jsonwebtoken at sign time
}