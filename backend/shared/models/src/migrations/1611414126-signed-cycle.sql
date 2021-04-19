ALTER TABLE `registrations` CHANGE `cycle` `cycle` int NOT NULL COMMENT 'Cycle of the group the registration is for';
ALTER TABLE `groups` CHANGE `cycle` `cycle` int NOT NULL DEFAULT '0' COMMENT 'Increased every time a new registration period started';
