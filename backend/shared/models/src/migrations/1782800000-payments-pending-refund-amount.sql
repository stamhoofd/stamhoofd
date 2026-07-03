ALTER TABLE `payments`
ADD COLUMN `pendingRefundAmount` bigint NOT NULL DEFAULT '0' AFTER `refundedAmount`;
