-- The identity an approval was granted to, so "is this still the same person?" is one indexed byte comparison
-- against the hash stored on the judicial record.
--
-- Generated rather than written by the backend so the definition exists in exactly one place: nothing in
-- TypeScript reproduces it, and it cannot drift from what the rows already hold.
--
-- The hash is deliberately exact. SHA2('JOSÉ') and SHA2('JOSE') differ, and that is the requirement, not a
-- defect to be fixed: any change to a recorded name is a change of identity and has to force a fresh check.
-- Do not "improve" this by folding accents, case or punctuation. There is no version column and no way to
-- recompute a hash of a member's former name, so adding folding would not reduce future renewals - it would
-- invalidate every approval that exists at the moment it shipped, and ask every approved member for a new
-- extract with no way back.
--
-- Stored as the lowercase hex SHA-256 under `ascii_bin`, a binary collation: comparison is byte-exact, so
-- neither this column nor judicial_records.identityHash can raise Illegal mix of collations or fold anything
-- together, however the tables are altered later. Hex rather than BINARY(32) because the model layer has no
-- blob column type, and a hash is worth nothing if the only way to read it is a conversion at each call site.
--
-- COALESCE on all three, not only birthDay: CONCAT_WS skips NULL arguments entirely, so a member with no first
-- name would shift the remaining fields one place left and could hash equal to a differently-shaped row. The
-- '|' separator is what stops 'AB' + 'C' colliding with 'A' + 'BC'.
ALTER TABLE `members`
ADD COLUMN `judicialIdentityHash` char(64) CHARACTER SET ascii COLLATE ascii_bin
    GENERATED ALWAYS AS (SHA2(CONCAT_WS('|',
        COALESCE(`firstName`, ''),
        COALESCE(`lastName`, ''),
        COALESCE(`birthDay`, '')
    ), 256)) STORED,
ADD INDEX `judicialIdentityHash` (`judicialIdentityHash`);
