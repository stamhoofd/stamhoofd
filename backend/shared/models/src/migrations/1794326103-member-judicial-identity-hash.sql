-- The identity an approval of a judicial record extract was granted to, so "is this still the same person?"
-- is one indexed comparison against the hash stored on the record.
--
-- A plain column rather than a generated one: `getJudicialIdentityHash` in @stamhoofd/models is the single
-- definition, written on every member save the same way firstName, lastName and birthDay already are. Keeping
-- it out of SQL means it is unit-testable without a database and has no generated-column semantics to work
-- around, and because the column is the only consumer there is still just one implementation.
--
-- Stored as lowercase hex SHA-256 under `ascii_bin`, a binary collation: comparison is byte-exact and cannot
-- fold anything together or raise Illegal mix of collations, however the tables are altered later. Hex rather
-- than BINARY(32) because the model layer has no binary column type - see the PR body.
--
-- Nullable only so this migration can add it before the backfill fills it in.
ALTER TABLE `members`
ADD COLUMN `judicialIdentityHash` char(64) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
ADD INDEX `judicialIdentityHash` (`judicialIdentityHash`);
