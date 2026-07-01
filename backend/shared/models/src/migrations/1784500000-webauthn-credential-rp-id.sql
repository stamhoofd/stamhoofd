-- The Relying Party ID a passkey was created for. A passkey only works on that domain, so
-- it has to be verified against the domain it was registered on, not against whatever the
-- dashboard domain happens to be later on.
--
-- Left NULL for rows that were created before this column existed: those were all made
-- against the platform RP ID, which the code falls back to (see WebauthnHelper).
ALTER TABLE `webauthn_credentials`
ADD COLUMN `rpId` varchar(255) NULL AFTER `credentialId`,
ADD COLUMN `backupEligible` tinyint(1) NOT NULL DEFAULT '0' AFTER `backedUp`;
