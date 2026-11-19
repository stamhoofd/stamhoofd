-- When the member was warned that the decision on this record is about to expire.
--
-- The warning goes out once per record, a month before the decision lapses, and this is what stops the cron
-- resending it every time it runs. It is deliberately not a counter: a second reminder about the same document
-- tells the member nothing the first one did not, and the record is superseded the moment they deliver again.
ALTER TABLE `judicial_records`
ADD COLUMN `expiryNotifiedAt` datetime DEFAULT NULL,
ADD INDEX `reviewedAt_expiryNotifiedAt` (`reviewedAt`,`expiryNotifiedAt`);
