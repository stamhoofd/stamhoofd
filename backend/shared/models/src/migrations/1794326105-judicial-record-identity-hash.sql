-- A copy of members.identityHash as it stood when the row was written, so "is this still the person
-- who was approved?" is one byte-exact comparison rather than a rehash of a name we may no longer have.
--
-- Copied rather than re-derived: the two can then only ever disagree because the member changed, which is
-- exactly the question being asked.
--
-- Added nullable and filled from the member, so the records that already exist keep matching the people they
-- were granted to, and only then made NOT NULL. Running it the other way round would invalidate every
-- approval in existence at the moment this shipped.
--
-- Same column type and binary collation as on members, so the comparison cannot fold anything together or
-- raise Illegal mix of collations however the tables are altered later.
ALTER TABLE `judicial_records`
ADD COLUMN `identityHash` char(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL;

UPDATE `judicial_records`
INNER JOIN `members` ON `members`.`id` = `judicial_records`.`memberId`
SET `judicial_records`.`identityHash` = `members`.`identityHash`;

-- Nothing may be left over: a record without a hash could not be compared, and treating it as a match would
-- keep approving a member whose name we never checked.
DELETE FROM `judicial_records` WHERE `identityHash` IS NULL;

ALTER TABLE `judicial_records`
MODIFY COLUMN `identityHash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
