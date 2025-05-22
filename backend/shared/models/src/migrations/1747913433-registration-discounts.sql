ALTER TABLE `registrations`
ADD COLUMN `discounts` json NOT NULL DEFAULT ('{"value": {}, "version": 0}');
