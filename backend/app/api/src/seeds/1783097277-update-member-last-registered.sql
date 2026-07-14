UPDATE `members` m
SET m.lastRegisteredAt = (
    SELECT MAX(r.registeredAt)
    FROM registrations r
    WHERE r.memberId = m.id
);
