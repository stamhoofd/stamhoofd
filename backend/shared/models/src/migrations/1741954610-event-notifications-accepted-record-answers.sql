ALTER TABLE `event_notifications`
ADD COLUMN `acceptedRecordAnswers` json NOT NULL DEFAULT ('{"value": {}, "version": 0}') AFTER `recordAnswers`;
