import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AppConfigService } from '../config/config.service';
import { buildMulterOptions } from './multer.config';
import { UploadService } from './upload.service';

/** Storage service + Multer config. Re-exporting MulterModule lets importers' FileInterceptor pick up the options. */
@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [AppConfigService],
      useFactory: buildMulterOptions,
    }),
  ],
  providers: [UploadService],
  exports: [UploadService, MulterModule],
})
export class UploadModule {}