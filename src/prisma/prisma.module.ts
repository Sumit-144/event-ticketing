import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
    providers: [PrismaService],  // registers PrismaService with NestJS's DI container within this module
    exports: [PrismaService]     // makes PrismaService available to other modules
})

export class PrismaModule{}