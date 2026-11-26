import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category } from '../../generated/prisma/client';
import { EventsCacheService } from '../cache/events-cache.service';
import { isPrismaError } from '../common/utils/prisma-error.util';
import { CategoriesRepository } from './categories.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly eventsCache: EventsCacheService,
  ) {}

  list(): Promise<Category[]> {
    return this.categoriesRepository.findAll();
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    try {
      return await this.categoriesRepository.create({
        name: dto.name,
        description: dto.description,
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    let updated: Category;
    try {
      updated = await this.categoriesRepository.update(id, {
        name: dto.name,
        description: dto.description,
      });
    } catch (error) {
      throw this.mapError(error);
    }
    // Category names are embedded in cached event lists (D13).
    await this.eventsCache.bumpListVersion();
    return updated;
  }

  async remove(id: string): Promise<void> {
    try {
      await this.categoriesRepository.delete(id);
    } catch (error) {
      throw this.mapError(error);
    }
    await this.eventsCache.bumpListVersion();
  }

  /** Throws 400 naming any id that does not exist. Used by events before linking categories. */
  async assertAllExist(ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return;
    const existing = new Set((await this.categoriesRepository.findAll()).map((c) => c.id));
    const missing = unique.filter((id) => !existing.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`Unknown category ids: ${missing.join(', ')}`);
    }
  }

  /** Translates DB errors into HTTP errors; anything unknown is rethrown as-is. */
  private mapError(error: unknown): unknown {
    if (isPrismaError(error, 'P2002')) {
      return new ConflictException('Category name already exists');
    }
    if (isPrismaError(error, 'P2025')) {
      return new NotFoundException('Category not found');
    }
    return error;
  }
}