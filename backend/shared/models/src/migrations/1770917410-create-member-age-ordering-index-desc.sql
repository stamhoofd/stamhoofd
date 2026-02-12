ALTER TABLE `members`
ADD UNIQUE INDEX `order_by_birth_day_desc` (`birthDay` desc, `id` desc) USING BTREE;
