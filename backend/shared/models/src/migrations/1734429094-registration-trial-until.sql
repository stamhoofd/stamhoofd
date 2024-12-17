ALTER TABLE `registrations`
ADD COLUMN `trialUntil` datetime NULL AFTER `registeredAt`,
ADD COLUMN `startDate` datetime NULL AFTER `registeredAt`;
