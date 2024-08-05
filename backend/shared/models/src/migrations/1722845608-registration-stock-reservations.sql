ALTER TABLE `registrations`
ADD COLUMN `stockReservations` json NOT NULL DEFAULT ('{"value": [], "version": 0}');
