import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from "@nestjs/common";
import { Redis } from "ioredis";
import { AppConfigService } from "../config/config.service";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    // Logger instance for logging connection status
    private readonly logger = new Logger(RedisService.name);
    private redisClient: Redis;

    // Constructor initializes the Redis client with configuration from AppConfigModule
    constructor(private readonly config: AppConfigService){
        this.redisClient = new Redis({
            host : this.config.redisHost,
            port : this.config.redisPort,
            password : this.config.redisPassword,
        });
    }

    // Lifecycle hook that runs when the module is initialized
    async onModuleInit() : Promise<void> {
        await this.redisClient.ping();
        this.logger.log('Connected to Redis successfully');
    }

    async onModuleDestroy() : Promise<void> {
        try {
            await this.redisClient.quit();
            this.logger.log('Redis connection closed');
        } catch (error) {
            this.logger.error('Error closing Redis connection', error);
        }
    }

    // Method to get the key value from Redis
    async get(key: string) : Promise<string | null> {
        return this.redisClient.get(key);
    }

    // Method to set the value and an optional expiration time
    async set(key: string, value: string, ttlSeconds?: number) : Promise<void> {
        if(ttlSeconds){
            await this.redisClient.set(key, value, 'EX', ttlSeconds);
        } else{
            await this.redisClient.set(key, value);
        }
    }

    // Method to delete a key from Redis
    async del(key : string) : Promise<void> {
        await this.redisClient.del(key);
    }

    // Method to check if a key exists in Redis
    async exists(key : string) : Promise<Boolean>{
        const result = await this.redisClient.exists(key);
        return result === 1;
    }

    // Method to set a key with expiry
    async setWithExpiry(key : string, value : string, ttlSeconds : number) : Promise<void> {
        await this.redisClient.set(key, value, "EX", ttlSeconds);
    }

    // Method to increment a key's value
    async increment(key : string) : Promise<number>{
        return this.redisClient.incr(key);
    }

    // Method to decrement a key's value
    async decrement(key : string) : Promise<number>{
        return this.redisClient.decr(key);
    }

    // Method to fetch all keys matching a pattern
    async keys(pattern : string) : Promise<string[]>{
        return this.redisClient.keys(pattern);
    }
}