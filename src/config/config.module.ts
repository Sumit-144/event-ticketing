import {Global, Module} from "@nestjs/common";
import {ConfigModule} from "@nestjs/config";
import {AppConfigService} from "./config.service";
import {validationSchema} from "./config.validation"

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
      validationOptions: {
        abortEarly: true, // stop at first missing var, don't dump all errors at once
      },
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}