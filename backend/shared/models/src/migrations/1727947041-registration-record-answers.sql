ALTER TABLE `registrations`
ADD COLUMN `recordAnswers` json NOT NULL DEFAULT ('{"value": {}, "version": 0}')  AFTER `options`;
