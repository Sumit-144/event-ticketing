# 🎟️ Event Management & Ticketing System

A production-grade REST API built with **NestJS**, demonstrating different backend engineering patterns.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS (Node.js + TypeScript) |
| Database | PostgreSQL + Prisma ORM (v7) |
| Caching | Redis (ioredis) |
| Background Jobs | BullMQ |
| Real-time | WebSockets (Socket.io) |
| Auth | JWT (Access + Refresh tokens) + Passport.js |
| Docs | Swagger / OpenAPI |
| Validation | class-validator + class-transformer |
| Security | Helmet, CORS, ThrottlerGuard (rate limiting) |
| Config | @nestjs/config + Joi validation |

---

## Architecture Overview

```
src/
├── config/         # Typed env config with Joi validation
├── prisma/         # PrismaService — database connection lifecycle
├── redis/          # RedisService — caching, blacklist, seat counts
├── common/         # Shared guards, interceptors, filters, decorators, pipes
├── auth/           # JWT auth, refresh token rotation, logout blacklist
├── users/          # User profile management
├── events/         # Event CRUD, publish/cancel, Redis cache-aside
├── categories/     # Event categories (ADMIN managed)
├── bookings/       # Atomic booking with Prisma $transaction
├── notifications/  # WebSocket gateway — real-time seat & booking updates
├── upload/         # Multer file upload — event banners
├── queue/          # BullMQ — email jobs, ticket generation, reminders
├── audit/          # Audit log via EventEmitter2 (decoupled side effects)
└── health/         # @nestjs/terminus — DB + Redis health checks
```

---

## Key Backend Patterns Demonstrated

**Authentication & Security**
- Short-lived JWT access tokens (15m) + long-lived refresh tokens (7d)
- Refresh token rotation with family-based reuse detection
- Token blacklisting in Redis on logout (O(1) lookup per request)
- RBAC with 3 roles: `ADMIN`, `ORGANIZER`, `ATTENDEE`
- JWT validation on WebSocket handshake

**Database**
- Atomic booking flow using Prisma `$transaction` with pessimistic locking
- Soft deletes on Events and Bookings (`deletedAt` pattern)
- Many-to-many (Event ↔ Category via explicit bridge table)
- Compound indexes for common query patterns

**Redis**
- Cache-aside pattern for event listings (TTL 5 min, invalidated on write)
- Seat availability counters for fast atomic reads
- Rate limiting store (works across horizontally scaled instances)
- JWT blacklist with TTL matching token expiry

**Background Jobs (BullMQ)**
- Email queue on booking confirmation (mocked, Nodemailer-ready)
- Ticket generation job decoupled from HTTP response
- Delayed reminder job fires 24hrs before event
- Retry with backoff + failed job handling

**API Design**
- Versioned routes: `/api/v1/...`
- Consistent response envelope: `{ success, data, message, meta }`
- Global `ValidationPipe` with whitelist + forbidNonWhitelisted
- Global `HttpExceptionFilter` for consistent error shape
- Full Swagger / OpenAPI documentation

---

## API Routes

```
AUTH
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout

USERS
GET    /api/v1/users/me
PATCH  /api/v1/users/me
GET    /api/v1/users              (ADMIN only)

EVENTS
GET    /api/v1/events             (public, cached, filterable)
GET    /api/v1/events/:id
POST   /api/v1/events             (ORGANIZER / ADMIN)
PATCH  /api/v1/events/:id
DELETE /api/v1/events/:id         (soft delete)
POST   /api/v1/events/:id/publish
POST   /api/v1/events/:id/cancel
POST   /api/v1/events/:id/banner  (file upload)

TICKET TIERS
GET    /api/v1/events/:id/tiers
POST   /api/v1/events/:id/tiers
PATCH  /api/v1/events/:id/tiers/:tierId

CATEGORIES
GET    /api/v1/categories         (public)
POST   /api/v1/categories         (ADMIN)
PATCH  /api/v1/categories/:id     (ADMIN)
DELETE /api/v1/categories/:id     (ADMIN)

BOOKINGS
POST   /api/v1/bookings
GET    /api/v1/bookings/me
GET    /api/v1/bookings/:id
PATCH  /api/v1/bookings/:id/cancel

HEALTH
GET    /api/v1/health

WEBSOCKET
ws://host/notifications           (JWT in handshake)
  → seats_updated
  → booking_confirmed
  → organizer_alert
```

---

## Getting Started

### Prerequisites
- Node.js v22+
- PostgreSQL
- Redis

### Setup

```bash
# Clone the repo
git clone https://github.com/your-username/event-ticketing.git
cd event-ticketing

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in your values in .env

# Run database migration
npx prisma migrate dev

# Generate Prisma client
npx prisma generate

# Start in development mode
npm run start:dev
```

### Swagger Docs

Once running, visit:
```
http://localhost:3000/api/docs
```

---

## Environment Variables

See `.env.example` for all required variables with descriptions.

Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `REDIS_HOST` | Redis host |
| `REDIS_PORT` | Redis port |
| `BCRYPT_SALT_ROUNDS` | bcrypt hashing rounds (10–12 recommended) |

---

## Current Progress

- [x] Project scaffold + dependency setup
- [x] Prisma schema (8 models, enums, indexes, soft deletes)
- [x] Database migration
- [x] Config module (typed env wrapper + Joi validation)
- [x] Prisma module (connection lifecycle)
- [ ] Redis module
- [ ] Common layer (guards, interceptors, filters, decorators)
- [ ] Auth module
- [ ] Users module
- [ ] Events module
- [ ] Categories module
- [ ] Bookings module
- [ ] Notifications (WebSockets)
- [ ] Upload module
- [ ] Queue module (BullMQ)
- [ ] Audit module
- [ ] Health module
- [ ] Testing

---

## License

MIT