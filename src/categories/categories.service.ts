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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { publishAudit } from '../common/events/publish.util';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoriesRepository: CategoriesRepository,
    private readonly eventsCache: EventsCacheService,
    private readonly emitter: EventEmitter2,
  ) {}

  list(): Promise<Category[]> {
    return this.categoriesRepository.findAll();
  }

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    let created: Category;
    try {
      created = await this.categoriesRepository.create({
        name: dto.name,
        description: dto.description,
      });
    } catch (error) {
      throw this.mapError(error);
    }
    publishAudit(this.emitter, {
      userId,
      entityType: 'Category',
      entityId: created.id,
      action: 'CREATE',
      before: null,
      after: { name: created.name, description: created.description },
    });
    return created;
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<Category> {
    let updated: Category;
    try {
      updated = await this.categoriesRepository.update(id, {
        name: dto.name,
        description: dto.description,
      });
    } catch (error) {
      throw this.mapError(error);
    }
    await this.eventsCache.bumpListVersion();
    publishAudit(this.emitter, {
      userId,
      entityType: 'Category',
      entityId: id,
      action: 'UPDATE',
      after: { name: updated.name, description: updated.description },
    });
    return updated;
  }

  async remove(userId: string, id: string): Promise<void> {
    try {
      await this.categoriesRepository.delete(id);
    } catch (error) {
      throw this.mapError(error);
    }
    await this.eventsCache.bumpListVersion();
    publishAudit(this.emitter, {
      userId,
      entityType: 'Category',
      entityId: id,
      action: 'DELETE',
    });
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