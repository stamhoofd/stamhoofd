ALTER TABLE `audit_logs`
ADD COLUMN `meta` json not NULL default ('{"value": {}, "version": 0}') AFTER `replacements`;
