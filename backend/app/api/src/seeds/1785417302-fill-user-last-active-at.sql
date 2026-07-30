UPDATE `users` u
SET u.lastActiveAt = (
    SELECT MAX(t.updatedAt)
    FROM tokens t
    WHERE t.userId = u.id
);
