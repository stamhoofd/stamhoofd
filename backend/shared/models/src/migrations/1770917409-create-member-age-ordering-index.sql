ALTER TABLE `members`
ADD UNIQUE INDEX `order_by_birth_day` (`birthDay`, `id`) USING BTREE;
