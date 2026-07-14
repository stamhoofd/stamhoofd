ALTER TABLE `email_templates`
ADD COLUMN `translations` json NOT NULL DEFAULT ('{"value": {}, "version": 0}');

ALTER TABLE `emails`
ADD COLUMN `translations` json NOT NULL DEFAULT ('{"value": {}, "version": 0}');

ALTER TABLE `email_recipients`
ADD COLUMN `language` varchar(2) NULL DEFAULT NULL;
