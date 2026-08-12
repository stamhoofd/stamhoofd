ALTER TABLE `settlements`
  ADD COLUMN `pendingFees` bigint NOT NULL DEFAULT '0' AFTER `unexplainedAmount`;
