-- When the member was told that the decision on this record no longer matches their name or birth date.
--
-- A separate marker from `expiryNotifiedAt` rather than a shared one: the two causes are independent, so a
-- record that drifts and later expires has to be able to announce both. One marker would let whichever came
-- first silence the other for the rest of the record's life.
--
-- The index covers the cron's selection, which reads the records that are not yet notified and compares their
-- stored hash against the member's.
ALTER TABLE `judicial_records`
ADD COLUMN `identityNotifiedAt` datetime DEFAULT NULL,
ADD INDEX `identityHash_identityNotifiedAt` (`identityHash`,`identityNotifiedAt`);
