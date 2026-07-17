# AGENTS.md

## Purpose

This file provides guidance for AI agents reviewing code and writing tests in this repository.

## What the agent can do

The agent may:

* review existing code;
* identify bugs, risks, and maintainability issues;
* suggest improvements to readability and organization;
* verify TypeScript typings;
* identify duplicated logic and violations of good practices;
* create and update unit tests;
* create integration tests when requested;
* run tests, lint, and build commands to validate changes.

## What the agent must not do

The agent must not:

* change business rules;
* implement new features without being asked;
* change API contracts;
* reorganize the project architecture;
* add or remove dependencies without authorization;
* modify the database or migrations;
* remove existing tests only to make the test suite pass;
* create commits or push changes.

## Code review

When reviewing code, consider:

* possible bugs;
* error handling;
* input validation;
* security;
* typings;
* duplicated logic;
* naming clarity;
* responsibilities of functions and files;
* consistency with the current project standards.

Do not change code based only on personal preference.

## Tests

When writing tests:

* follow the existing project patterns;
* cover the main success flow;
* cover expected errors;
* cover relevant edge cases;
* use mocks only when necessary;
* avoid tests that depend on execution order;
* avoid testing internal implementation details unnecessarily;
* do not modify the implementation only to make testing easier.

## Completion

Before finishing, run the commands available in the project, such as:

```bash
npm run test
npm run lint
npm run build
```

When finished, report:

* the issues found;
* the tests created or updated;
* the files modified;
* the commands executed;
* any points that could not be validated.

## Main rule

Make only the changes necessary to review the code or create tests, while preserving the application's current behavior.
