import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, User } from '../../generated/prisma/client';
import { CreateUserData, UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async create(data: CreateUserData): Promise<User> {
    try {
      return await this.usersRepository.create(data);
    } catch (error) {
      // P2002 = unique constraint violation. Catching it (instead of
      // "find first, then create") is safe even if two requests race.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }
}