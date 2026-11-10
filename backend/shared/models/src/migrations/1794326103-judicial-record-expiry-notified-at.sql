-- When the member was warned that the decision on this record is about to expire.
--
-- The warning goes out once per record, a month before the decision lapses, and this is what stops the cron
-- resending it every time it runs. It is deliberately not a counter: a second reminder about the same document
-- tells the member nothing the first one did not, and the record is superseded the moment they deliver again.
--
-- Identity drift does not write here. A member whose name was corrected is not emailed at all - the mismatch is
-- shown in the portal and in the member detail instead - because the identity hash is exact by design, so an
-- administrator fixing a capitalisation would otherwise send that member to a government counter for nothing.
ALTER TABLE `judicial_records`
ADD COLUMN `expiryNotifiedAt` datetime DEFAULT NULL,
ADD INDEX `reviewedAt_expiryNotifiedAt` (`reviewedAt`,`expiryNotifiedAt`);
