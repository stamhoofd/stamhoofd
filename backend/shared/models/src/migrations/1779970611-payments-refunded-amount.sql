ALTER TABLE `payments`
ADD COLUMN `refundedAmount` bigint NOT NULL DEFAULT '0' AFTER `price`;
