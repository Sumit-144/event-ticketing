import { BadRequestException } from '@nestjs/common';
import type { MulterModuleOptions } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AppConfigService } from '../config/config.service';
import { ALLOWED_IMAGE_MIME_TYPES } from './upload.constants';

/**
 * Multer options built from config. Memory storage keeps rejected uploads off the disk;
 * the size cap makes that safe. Oversize requests become 413 (Nest maps LIMIT_FILE_SIZE).
 */
export const buildMulterOptions = (config: AppConfigService): MulterModuleOptions => ({
  storage: memoryStorage(),
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(new BadRequestException('Only JPEG, PNG and WebP images are allowed'), false);
  },
});