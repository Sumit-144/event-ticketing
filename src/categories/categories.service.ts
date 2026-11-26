import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category } from '../../generated/prisma/client';
import { isPrismaError } from '../common/utils/prisma-error.util';
import { CategoriesRepository } from './categories.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

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
    try {
      return await this.categoriesRepository.update(id, {
        name: dto.name,
        description: dto.description,
      });
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.categoriesRepository.delete(id);
    } catch (error) {
      throw this.mapError(error);
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