ALTER TABLE `members`
ADD INDEX `name` (`firstName`,`lastName`) USING BTREE,
ADD INDEX `birthDay` (`birthDay`) USING BTREE;
