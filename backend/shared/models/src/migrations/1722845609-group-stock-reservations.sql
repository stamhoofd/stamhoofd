ALTER TABLE `groups`
ADD COLUMN `stockReservations` json NOT NULL DEFAULT ('{"value": [], "version": 0}');
