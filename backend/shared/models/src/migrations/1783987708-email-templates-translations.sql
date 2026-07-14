ALTER TABLE `email_templates`
ADD COLUMN `translations` json NOT NULL DEFAULT ('{"value": {}, "version": 0}');
