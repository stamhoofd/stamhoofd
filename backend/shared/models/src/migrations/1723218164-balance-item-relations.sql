ALTER TABLE `balance_items`
ADD COLUMN `relations` json NOT NULL DEFAULT ('{"value": {}, "version": 0}');
