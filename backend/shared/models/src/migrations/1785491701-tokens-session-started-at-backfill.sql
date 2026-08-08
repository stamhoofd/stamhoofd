-- Existing sessions start counting from the token they are on right now. Tokens rotate
-- every 15 minutes, so this is at most that much extra session length.
UPDATE `tokens` SET `sessionStartedAt` = `createdAt`;
