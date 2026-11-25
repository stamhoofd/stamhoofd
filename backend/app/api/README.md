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

## Monthly invoice completion

Set `MONTHLY_INVOICE_HEARTBEAT_URL` only on a deployment that runs billing
crons. Store its separate Better Stack URL in 1Password. Set a monthly deadline
after the 10th (Europe/Brussels), with grace for the five-hour startup delay
and enough five-minute ticks to scan all organizations (at most 50 per tick).

A ping means the entire organization scan finished without interruption. An
empty scan or one spanning a month boundary qualifies. After a restart the
cursor starts over; completing the new scan sends another ping even in the
same month. Payments already linked to an invoice are skipped.

Customer invoice errors are reported to organization admins and do not interrupt
the scan. Once the API's worker metrics are ingested in Better Stack, alert on
an increase in `stamhoofd_worker_outcomes_total{worker="invoice_create",outcome="error"}`
to detect those failures independently of scan completion.

## Nightly settlement completion

Configure `SETTLEMENT_SYNC_HEARTBEAT_URL` from 1Password only on the production
deployment responsible for the nightly reconciliation. Use a daily monitor with
grace past 06:00 Europe/Brussels for queueing, provider calls, reporting and the
daylight-saving change. A missed window should alert that deployment's owner;
staging, disabled cron hosts and manual backfills should have no monitor.

A clean walk, even with no new payouts, signals after follow-up reporting.
Provider, fee-month and old-payout retry failures do not signal. A returned
partial summary still consumes that day's run; a thrown error or shutdown
abort leaves it eligible for another tick before 06:00. An undeliverable
heartbeat does not trigger another reconciliation. Existing problem reports
remain the source for individual payout discrepancies.

## SES queue polling

Each five-minute API cron polls one queue. Keep a separate 1Password heartbeat
URL per configured queue and deployment:

| Queue setting                        | Heartbeat setting             |
| ------------------------------------ | ----------------------------- |
| `AWS_BOUNCE_QUEUE_URL`               | `SES_BOUNCE_HEARTBEAT_URL`    |
| `AWS_COMPLAINTS_QUEUE_URL`           | `SES_COMPLAINT_HEARTBEAT_URL` |
| `AWS_FORWARDING_QUEUE_URL` (replies) | `SES_REPLY_HEARTBEAT_URL`     |

Enable monitors only for active consumers with AWS credentials. A successful
empty receive or a clean bounded pass signals once. A failed receive, delete,
unacknowledgeable or unsupported message, or handler exception suppresses that
poll’s signal. The existing delete-before-dispatch policy still applies:
a missing ping does not mean a failed message will be redelivered. Reply
processing includes filtering and scheduling mail, not downstream mail delivery.
Allow grace for a full scheduler cycle and processing time.

Receive and delete errors identify the queue role and include available AWS error
codes, HTTP status and request IDs. On a message-processing failure, the API logs
the SQS message ID, whether deletion succeeded, the processing step and available
source locations. Mail content and receipt handles are omitted.
