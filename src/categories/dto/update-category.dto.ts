import { PartialType } from '@nestjs/swagger';
import { CreateCategoryDto } from './create-category.dto';

/** Same rules as create, every field optional. Inherits validation + Swagger metadata. */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}