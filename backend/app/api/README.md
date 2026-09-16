# Stamhoofd backend application

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

From the repository root:

```bash
pnpm stam test api
```
