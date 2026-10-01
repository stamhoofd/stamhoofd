ALTER TABLE `registrations`
ADD COLUMN `registeredByMember` tinyint(1) NOT NULL DEFAULT '0' AFTER `sendConfirmationEmail`;
