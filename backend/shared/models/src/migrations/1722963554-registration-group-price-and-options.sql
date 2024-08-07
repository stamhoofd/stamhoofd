ALTER TABLE `registrations`
ADD COLUMN `options` json NOT NULL DEFAULT ('{"value": [], "version": 0}') AFTER `price`,
ADD COLUMN `groupPrice` json NOT NULL DEFAULT ('{"value": {"id": "unknown", "name": "Onbekend", "price": {"price": 0, "reducedPrice": null}}, "version": 0}') AFTER `price`;
