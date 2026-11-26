import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'path';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { UPLOADS_URL_PREFIX } from './upload/upload.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(AppConfigService);
  app.enableShutdownHooks();

  // Banners are public by design. Filenames are unique UUIDs, so they cache forever.
  app.useStaticAssets(resolve(config.uploadDest), {
    prefix: `${UPLOADS_URL_PREFIX}/`,
    index: false,
    maxAge: '7d',
    immutable: true,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });

  await app.listen(config.port);
}
bootstrap();