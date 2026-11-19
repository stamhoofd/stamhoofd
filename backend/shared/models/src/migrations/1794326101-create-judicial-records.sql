-- One row per member, enforced by the database rather than by whoever writes next: a new delivery replaces
-- the one before it. That makes "the member's record" an indexed equality join instead of a correlated
-- max(createdAt) per member on every member-list query, and it means a temporarily rejected member who
-- delivers again leaves nothing behind.
--
-- There is deliberately no organizationId: an approval is a fact about a person, so an extract approved on
-- behalf of one organization is approved for every organization the member is registered in. The reviewing
-- organization is kept inside reviewDetails for the audit trail, never as a scoping key.
--
-- The requirement stays per-organization even so, because JudicialRecordHelper.asksForExtract consults the
-- platform responsibilities and the organization's own. So two organizations can disagree about whether this
-- member needs an extract while agreeing about the one they delivered.
--
-- No date from the document is kept. Validity runs from the review - approved on this date, valid for so long
-- after it - so nothing has to be recomputed from a file that is deleted as soon as a decision is made. The
-- Age check still reads the signing date at delivery; it simply is not persisted.
CREATE TABLE `judicial_records` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `memberId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `reviewDecision` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,

  -- Reviewer name, email, organization and any comment, denormalised on purpose: the audit has to stay
  -- readable after the user is renamed, loses the permission or is deleted. Null while nobody has looked yet.
  `reviewDetails` json DEFAULT NULL,

  -- When a reviewer decided, null while nobody has. A column rather than a field inside reviewDetails because
  -- expiry is evaluated on every member-list query, and a JSON extraction there cannot be indexed.
  `reviewedAt` datetime DEFAULT NULL,

  -- Storage reference plus why and when it was removed. Null once nothing is stored any more.
  `file` json DEFAULT NULL,

  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `one_record_per_member` (`memberId`),
  CONSTRAINT `judicial_records_ibfk_1` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
