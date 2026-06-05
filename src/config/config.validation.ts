import * as Joi from 'joi';

/**
 * When the application starts, it will validate the environment variables against this schema.
 * If any variable is missing or invalid, the application will throw an error and exit.
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().default(3000),

  // Database
  DATABASE_URL: Joi.string().required(),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  // App settings
  BCRYPT_SALT_ROUNDS: Joi.number().default(12),
  UPLOAD_DEST: Joi.string().default('./uploads'),
  MAX_FILE_SIZE_MB: Joi.number().default(5), // 5MB

  // CORS
  CORS_ORIGIN: Joi.string().default('http://localhost:3001'),

  // Throttle
  THROTTLE_TTL: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(100),
});