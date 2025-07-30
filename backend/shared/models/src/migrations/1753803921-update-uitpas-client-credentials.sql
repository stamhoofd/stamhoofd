ALTER TABLE `uitpas_client_credentials`
ADD COLUMN `useTestEnv` tinyint(1) NOT NULL DEFAULT FALSE AFTER `organizationId`;
