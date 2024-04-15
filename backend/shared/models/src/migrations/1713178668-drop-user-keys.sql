ALTER TABLE `users`
DROP COLUMN `requestKeys`,
DROP COLUMN `publicKey`,
DROP COLUMN `publicAuthSignKey`,
DROP COLUMN `authSignKeyConstants`,
DROP COLUMN `authEncryptionKeyConstants`,
DROP COLUMN `encryptedPrivateKey`;