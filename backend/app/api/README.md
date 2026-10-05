# Stamhoofd backend application

## Architecture

The API uses `@simonbackx/simple-endpoints`, not Express. Each endpoint is a class in `src/endpoints/**` with typed input decoders that returns `@stamhoofd/structures` data. Endpoints translate between database models and versioned structures. Errors use `@simonbackx/simple-errors`; follow the [error translation conventions](../../../README.md#localizations-and-translations).

Read the relevant endpoint and database-storage documentation in the [Notion developer guide](https://app.notion.com/p/Getting-started-20cc403f36798075b190c84c2c21d1ec) before writing endpoints.

To run, make sure you set your environment variables.

You can create a `.env` file:

```
# Database
DB_HOST=localhost
DB_USER=root
DB_PASS=root
DB_DATABASE=stamhoofd

# SMTP server (for sending emails)
SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_USERNAME=xxxx
SMTP_PASSWORD=xxxx
SMTP_PORT=xxxx
```

## Setup

From the repository root, install dependencies and run the migrations to setup the database.

```bash
pnpm install
pnpm run build:shared
pnpm --dir backend/app/api run migrations
```

## Running

From the repository root:

```bash
pnpm --dir backend/app/api run start
```

## Testing

Endpoint changes need unit and integration coverage. Use `TestUtils.setEnvironment(...)` to simulate different environments. See [testing expectations](../../../CONTRIBUTING.md#testing-expectations) and the [CLI test reference](../../../shared/cli/README.md#tests).

From the repository root:

```bash
pnpm stam test api
```
