# AGENTS.md

## Purpose

Use AI to review, test, and change this repository only when explicitly requested.

Before changing code, read:

- `docs/ARCHITECTURE.md`
- `docs/BUSINESS_RULES.md`

These documents describe the current implementation and are the repository references for architecture and business behavior.

## Project context

This is a contract-management REST API built with Node.js, TypeScript, Express, Prisma, PostgreSQL, Zod, JWT, Redis, RabbitMQ, and Vitest.

The API supports authentication, client creation and listing, contract CRUD, manual closing, soft deletion of contracts, status summaries, Redis caching, and asynchronous expiration.

## Architecture rules

Keep the current flow:

```text
Controller -> validation -> service -> repository -> Prisma/PostgreSQL
Scheduler -> RabbitMQ -> worker -> expiration service
Service -> Redis cache
```

- Controllers handle HTTP concerns.
- Zod schemas validate and normalize request input.
- Services own business rules and application errors.
- Repositories own database queries.
- Infrastructure modules own Prisma, Redis, and RabbitMQ integration.
- Do not access Prisma from controllers.
- Do not place database-dependent rules in validation schemas.
- Do not reorganize the architecture without permission.

## Before changing code

1. Read the relevant code, tests, Prisma schema, and migrations.
2. Check the working tree and preserve user changes.
3. Identify affected routes, rules, and layers.
4. Compare the requested behavior with `docs/BUSINESS_RULES.md`.
5. Explain assumptions or conflicts that may change behavior.

## Change rules

- Make the smallest complete change for the request.
- Avoid unrelated refactors.
- Preserve existing API behavior unless a change is explicitly requested.
- Do not add, remove, or upgrade dependencies without permission.
- Do not change business rules without permission.
- Create a new migration for schema changes; do not edit migration history.
- Keep Redis failures from corrupting PostgreSQL behavior.
- Invalidate the contract summary cache after successful relevant mutations.
- Keep RabbitMQ expiration processing idempotent.
- Do not expose secrets, credentials, tokens, or `.env` contents.
- Do not create commits or push changes unless requested.

## Tests

Add or update tests for every changed behavior. Cover the success path, expected errors, and relevant edge cases.

- Follow existing test patterns.
- Test observable behavior instead of internal implementation details.
- Use mocks only when needed.
- Do not depend on test execution order.
- Do not remove or weaken tests to make the suite pass.
- Do not change production behavior only to simplify testing.

Before completion, run:

```bash
npm test
npm run lint
npm run build
```

For schema changes, also validate the Prisma schema and migration path. Report anything that could not be verified.

## Review checklist

Review changes for:

- business-rule correctness;
- input validation;
- authentication and sensitive-data exposure;
- error handling;
- TypeScript types;
- soft-deletion filters;
- cache consistency;
- RabbitMQ acknowledgement, retry, and idempotency;
- migration safety;
- duplicated logic and unclear responsibilities.

Do not propose changes based only on style preference.

## Completion report

Report:

- behavior implemented;
- files and migrations changed;
- tests added or updated;
- commands and results;
- API changes, assumptions, and remaining risks.

## Main rule

Implement only what was requested, preserve unrelated behavior, and leave the repository in a verifiable state.
