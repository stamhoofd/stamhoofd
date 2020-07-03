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

Install dependencies and run the migrations to setup the database.

```
yarn install
yarn migrations
```

## Running

```
yarn start
```

## Testing

```
yarn test
```
