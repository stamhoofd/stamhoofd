ALTER TABLE `emails`
ADD COLUMN `translations` json NOT NULL DEFAULT ('{"value": {}, "version": 0}');
