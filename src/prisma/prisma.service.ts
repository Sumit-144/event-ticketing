import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import { AppConfigService } from "../config/config.service";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    constructor(private readonly config: AppConfigService) {
        const pool = new Pool({
        connectionString: config.databaseUrl,
        });
        const adapter = new PrismaPg(pool);
        super({ adapter } as any);
    }

    async onModuleInit() {
        await this.$connect();
        this.logger.log("Database connected");
    }

    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.log("Database disconnected");
    }
}