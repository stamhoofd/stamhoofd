ALTER TABLE `email_verification_codes`
CHANGE `organizationId` `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL;