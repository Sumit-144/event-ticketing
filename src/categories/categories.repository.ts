import { Injectable } from '@nestjs/common';
import { Category } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CategoryData {
  name?: string;
  description?: string;
}

@Injectable()
export class CategoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  create(data: { name: string; description?: string }): Promise<Category> {
    return this.prisma.category.create({ data });
  }

  /** Throws P2025 if the id does not exist. */
  update(id: string, data: CategoryData): Promise<Category> {
    return this.prisma.category.update({ where: { id }, data });
  }

  /** Throws P2025 if the id does not exist. EventCategory rows cascade. */
  async delete(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }
}