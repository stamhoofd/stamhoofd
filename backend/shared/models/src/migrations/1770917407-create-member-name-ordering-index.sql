ALTER TABLE `members`
ADD UNIQUE INDEX `order_by_name` (`firstName`,`lastName`,`id`) USING BTREE;
