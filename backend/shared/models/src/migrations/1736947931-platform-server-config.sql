ALTER TABLE `platform`
ADD COLUMN `serverConfig` json not NULL DEFAULT ('{"value": {}, "version": 0}') AFTER `config`;
