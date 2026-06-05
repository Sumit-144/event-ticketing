import { Module } from '@nestjs/common';
import {AppConfigModule} from "./config/config.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule
  ],
  providers: [AppConfigModule],
})
export class AppModule {}
