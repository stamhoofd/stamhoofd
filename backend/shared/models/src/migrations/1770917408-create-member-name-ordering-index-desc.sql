ALTER TABLE `members`
ADD UNIQUE INDEX `order_by_name_desc` (`firstName` desc,`lastName` desc,`id` desc) USING BTREE;
