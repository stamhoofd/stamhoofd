ALTER TABLE `organization_registration_periods`
ADD COLUMN `setupSteps` json NOT NULL DEFAULT ('{"value": {}, "version": 0}');
