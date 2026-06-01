ALTER TABLE `document_templates`
ADD COLUMN `isLocked` tinyint(1) NOT NULL DEFAULT '0' AFTER `publishedAt`;
