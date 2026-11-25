# Stamhoofd Backup service

The backup service is a service that periodically creates a backup of the local MySQL server and stores it in encrypted form to an external object storage like S3.

### Completion heartbeats

The scheduler checks on startup and every five minutes. A full backup is due
once per day between 02:00 and 05:00 inclusive (Europe/Brussels); a busy queue
or failed upload leaves the next eligible tick free to retry. Binlogs run each
tick, including uploading a fresh partial copy of the active log. An empty log
list or failure anywhere in the pass sends no heartbeat, even if an earlier
log was stored. Manual full backups and startup cleanup do not send heartbeats.

For each confirmed active backup host, store separate secret HTTPS URLs in
1Password and inject `FULL_BACKUP_HEARTBEAT_URL` and `BINLOG_BACKUP_HEARTBEAT_URL`
only into that host's backup service. Either may be omitted independently.
Use a daily monitor for full backups and a five-minute monitor for binlogs,
with grace for the scheduling window, upload duration and skipped overlapping
ticks. Keep the keyed health check: it independently checks freshness and
minimum full-backup size.

Backup roles are configured on `keeo-replica-002`, `ravot-replica-002`,
`jamboree-api-002`, and both `stamhoofd-replica-002` and `stamhoofd-replica-003`.
The latter has a disable-on-failover note; `IS_REPLICA` is not a leadership
signal. Leave Stamhoofd heartbeat alerts disabled until operators confirm
which backup destinations must remain active and who owns them after failover.
