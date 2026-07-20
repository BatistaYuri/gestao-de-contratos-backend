# Backend Architecture

## Stack

- Node.js, TypeScript, and Express
- Prisma and PostgreSQL
- Zod validation
- JWT authentication with `jose`
- Redis summary cache
- RabbitMQ asynchronous processing
- Vitest, ESLint, and TypeScript compiler

## Processes

The backend has three entry points:

- `src/server.ts`: starts the REST API.
- `src/scheduler.ts`: periodically publishes expiration messages.
- `src/worker.ts`: consumes messages and expires eligible contracts.

They run as separate processes through the scripts defined in `package.json`.

## HTTP flow

```text
Request
  -> Express JSON middleware
  -> JWT authentication
  -> Zod validation
  -> controller
  -> service
  -> repository
  -> Prisma/PostgreSQL
```

- Controllers define routes and HTTP responses.
- Zod schemas validate request bodies and route parameters.
- Services implement business rules.
- Repositories isolate Prisma queries for their own modules. Cross-module rules are
  implemented by injecting the relevant repositories into the service; for example,
  the contract service uses the client repository to validate eligible clients.
- Middleware handles authentication, validation, and errors.
- Infrastructure modules integrate Prisma, Redis, and RabbitMQ.

## Modules

```text
src/
├── config/          Environment configuration
├── infra/           Database, Redis, and RabbitMQ
├── middleware/      Authentication, validation, and errors
└── modules/
    ├── auth/
    ├── clients/
    └── contract/
```

## Authentication

Login uses credentials from environment variables and returns an HS256 JWT. Client and contract routes require a bearer token. The backend does not store sessions or expose a logout endpoint.

## Persistence

PostgreSQL is the source of truth. Prisma defines:

- `Client`: UUID, name, unique document, soft-deletion timestamp, timestamps, and contracts.
- `Contract`: UUID, unique number, client, decimal value, due date, lifecycle status, closing timestamp, soft-deletion timestamp, and timestamps.
- `ContractStatus`: `ACTIVE`, `EXPIRED`, and `CLOSED`.

Contracts belong to one client. Normal contract queries, counts, and expiration processing exclude soft-deleted contracts.
Normal client queries exclude soft-deleted clients. Contract creation and updates can only reference non-deleted clients.

The repository contains incremental migrations for client and contract creation, soft deletion, and query indexes. Client deletion checks for non-deleted related contracts in the service before persisting its timestamp.

## Redis cache

Redis caches the contract status summary under one key with a configured TTL.

The summary flow is:

1. Read and validate the cached JSON value.
2. Query PostgreSQL after a miss, invalid value, or Redis failure.
3. Normalize and cache active, expired, closed, and total counts.

Contract creation, update, closing, and deletion invalidate the cache after persistence. The expiration worker invalidates it when at least one contract changes. Redis errors are logged and handled without failing the database operation.

## RabbitMQ expiration

```text
Scheduler -> direct exchange -> expiration queue -> worker
          -> retry queues -> dead-letter queue
```

The scheduler publishes immediately at startup and then at the configured interval. Messages are persistent and use publisher confirmation.

The worker consumes one message at a time. It expires active, non-deleted contracts whose due date is before the current day. Failed processing uses two delayed retries before dead-letter routing. Successful processing and safe retry publication acknowledge the original message.

## Errors

Expected application failures use `AppError`. Zod failures return `400` with validation issues. Authentication errors return `401`. Unexpected failures return a generic `500` response.

## Tests and validation

Tests under `tests/` cover validation, services, authentication middleware, Redis cache behavior, and RabbitMQ expiration behavior.

Project checks:

```bash
npm test
npm run lint
npm run build
```
