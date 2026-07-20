# Business Rules

This document describes only the behavior currently implemented in the backend.

## Authentication

- Login accepts the configured username and password.
- Invalid credentials return `401 Unauthorized`.
- Successful login returns an expiring HS256 JWT.
- Client and contract routes require `Authorization: Bearer <token>`.
- Missing, invalid, or expired tokens return `401 Unauthorized`.
- The backend does not maintain sessions or provide a logout endpoint.

## Clients

- A client has a name and document.
- The name must contain at least two characters after trimming.
- The document is reduced to numeric characters and must contain at least one digit.
- The document is unique.
- Duplicate documents return `409 Conflict`.
- Clients are listed alphabetically by name.
- The API supports creating, listing, viewing, updating, and soft-deleting clients.
- Client IDs in detail, update, and deletion routes must be UUIDs.
- Updates accept name and document and use the same trimming and numeric document normalization as creation.
- A client may retain its current document, but may not use a document belonging to another client.
- Deleted clients are absent from list and detail queries and return `404 Not Found`.
- A client with a non-deleted contract cannot be deleted and returns `409 Conflict`.
- A client may be deleted when all related contracts are soft-deleted.
- Documents remain unique and reserved after client deletion.
- A contract can reference only an existing, non-deleted client.

## Contracts

### Required data

- Contract number is required and unique.
- Client ID must be a UUID for an existing client.
- A contract must contain at least one item; clients do not send `value` or `subtotal`.
- Item descriptions are required, quantities are positive decimals with at most three decimal places, and unit prices are non-negative decimal strings with at most two decimal places.
- Contract type is required and must be `SERVICE`, `SUPPLY`, `RENTAL`, or `OTHER`.
- Currency is limited to `BRL`.
- Discount and additional fees are non-negative decimal strings with at most two decimal places.
- `subtotal` is the sum of `quantity * unitPrice`, rounded to two decimal places.
- `value` is calculated as `subtotal - discount + additionalFees` and cannot be negative.
- Due date must be a valid `YYYY-MM-DD` date.
- Unknown fields are rejected by strict validation.

### Lifecycle status

```text
ACTIVE | EXPIRED | CLOSED
```

- On creation, a due date before the current day produces `EXPIRED`.
- A due date equal to or after the current day produces `ACTIVE`.
- Updating a non-closed contract recalculates its status from the due date.
- Only draft or rejected contracts can be edited.
- Closing a contract sets `CLOSED` and records `closedAt`.
- Closing an already closed contract returns `409 Conflict`.
- Only approved contracts can be closed.

### Approval

```text
DRAFT --submit--> PENDING
PENDING --approve--> APPROVED
PENDING --reject--> REJECTED
REJECTED --submit--> PENDING
```

- Approval state is independent from lifecycle status.
- Only draft or rejected contracts can be submitted.
- Only pending contracts can be approved or rejected.
- Rejection requires a non-empty reason.
- Every submission creates an immutable, sequential revision with a JSON snapshot of the submitted contract.
- Approval or rejection updates only the pending revision with its decision date and optional rejection reason.
- Rejected revisions remain available after adjustment and resubmission, preserving the complete decision history.
- Revision creation and status transition occur in the same database transaction.
- An approved contract cannot return to draft.
- `GET /api/contracts/:id/approval-history` returns revisions in ascending version order.

### Queries

- Contract lists and details include client and item data.
- Contracts are ordered by due date ascending and creation date descending.
- Lists can be filtered by lifecycle status, contract type, approval status, and client ID.
- Contract detail requires a valid UUID.
- Missing or soft-deleted contracts return `404 Not Found`.

### Update

- Update replaces number, client, type, due date, currency, discount, additional fees, and the complete item collection in one database transaction.
- Items and derived totals cannot be changed after approval because only draft or rejected contracts are editable.
- The new client must exist.
- The number may remain assigned to the same contract.
- A number assigned to another contract returns `409 Conflict`.

### Deletion

- Contract deletion is logical and sets `deletedAt`.
- A successful deletion returns `204 No Content`.
- Deleted contracts are hidden from list and detail queries.
- Deleted contracts are excluded from summaries and automatic expiration.

## Contract summary

- The summary contains `active`, `expired`, `closed`, and `total`.
- Missing statuses are returned with a zero count.
- `total` equals the sum of the three status counts.
- Soft-deleted contracts are not counted.
- Redis caches the summary with a configured TTL.
- Invalid cached data or Redis failures fall back to PostgreSQL.
- Contract creation, update, approval transitions, closing, and deletion invalidate the cache.

## Automatic expiration

- The scheduler publishes an expiration message immediately and at a configured interval.
- The worker changes only `ACTIVE`, non-deleted contracts.
- A contract expires when its due date is strictly before the current day.
- Processing is idempotent because already expired contracts no longer match the update.
- Cache invalidation occurs only when at least one contract is updated.
- Failed messages receive two delayed retries and are then routed to a dead-letter queue.
- Messages with an unexpected type are rejected without requeueing.

## HTTP conventions

- Invalid request data: `400 Bad Request`.
- Missing or invalid authentication: `401 Unauthorized`.
- Missing resource: `404 Not Found`.
- Duplicate value or invalid state: `409 Conflict`.
- Successful creation: `201 Created`.
- Successful deletion: `204 No Content`.
- Unexpected failure: generic `500 Internal Server Error`.
