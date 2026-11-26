import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { basename, join, resolve } from 'path';
import { AppConfigService } from '../config/config.service';
import { EVENT_BANNER_SUBDIR, UPLOADS_URL_PREFIX } from './upload.constants';
import { detectImageType } from './utils/image-type.util';

/** File storage (local disk for now; S3 is the natural swap behind this same interface). */
@Injectable()
export class UploadService implements OnModuleInit {
  private readonly logger = new Logger(UploadService.name);
  private readonly bannerDir: string;

  constructor(config: AppConfigService) {
    this.bannerDir = resolve(config.uploadDest, EVENT_BANNER_SUBDIR);
  }

  /** Fail loudly at startup if the upload folder cannot be created. */
  async onModuleInit(): Promise<void> {
    await mkdir(this.bannerDir, { recursive: true });
    this.logger.log(`Banner uploads stored in ${this.bannerDir}`);
  }

  /**
   * Validates the real content, stores the file under a server-generated name and returns
   * its public URL path. The client's filename is never used.
   */
  async saveEventBanner(file: Express.Multer.File): Promise<string> {
    const detected = detectImageType(file.buffer);
    if (!detected) {
      throw new BadRequestException('File content is not a valid JPEG, PNG or WebP image');
    }
    const name = `${randomUUID()}.${detected.ext}`;
    await writeFile(join(this.bannerDir, name), file.buffer, { flag: 'wx' });
    return `${UPLOADS_URL_PREFIX}/${EVENT_BANNER_SUBDIR}/${name}`;
  }

  /** Best-effort delete by public URL. Ignores URLs that are not ours; never throws. */
  async deleteBanner(publicUrl: string | null | undefined): Promise<void> {
    const prefix = `${UPLOADS_URL_PREFIX}/${EVENT_BANNER_SUBDIR}/`;
    if (!publicUrl?.startsWith(prefix)) return;
    try {
      await unlink(join(this.bannerDir, basename(publicUrl.slice(prefix.length))));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Could not delete ${publicUrl}: ${(error as Error).message}`);
      }
    }
  }
}