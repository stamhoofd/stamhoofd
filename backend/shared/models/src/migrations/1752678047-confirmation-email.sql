ALTER TABLE `registrations`
ADD COLUMN `sendConfirmationEmail` tinyint(1) NOT NULL DEFAULT '1' AFTER `canRegister`;
