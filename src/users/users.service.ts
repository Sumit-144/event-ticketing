import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '../../generated/prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserData, UsersRepository } from './users.repository';
import { SafeUser } from './users.types';

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

  /** Current user's profile, without sensitive columns. */
  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.usersRepository.findSafeById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Updates only name/avatarUrl; an empty body is a no-op that returns the profile. */
  async updateProfile(userId: string, dto: UpdateUserDto): Promise<SafeUser> {
    if (dto.name === undefined && dto.avatarUrl === undefined) {
      return this.getProfile(userId);
    }
    try {
      return await this.usersRepository.updateProfile(userId, {
        name: dto.name,
        avatarUrl: dto.avatarUrl,
      });
    } catch (error) {
      // P2025 = record to update not found (missing or soft-deleted).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  /** Paginated user list (admin). Shape matches what ResponseWrapperInterceptor lifts. */
  async list(pagination: PaginationDto) {
    const [items, total] = await this.usersRepository.findManyPaginated(
      pagination.skip,
      pagination.limit,
    );
    return {
      items,
      meta: { page: pagination.page, limit: pagination.limit, total },
    };
  }
}