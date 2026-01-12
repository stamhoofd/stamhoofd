ALTER TABLE `document_templates`
ADD COLUMN `year` int NOT NULL DEFAULT '0' AFTER `updatesEnabled`;
