ALTER TABLE `webshops` CHANGE `uri` `legacyUri` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL, ADD COLUMN `uri` varchar(100) NULL AFTER `categories`;
update webshops 
    left join organizations on organizations.id = webshops.organizationId
    set webshops.uri = TRIM('-' from CONCAT(organizations.uri, '-', webshops.legacyUri));

-- Correct duplicate uri with counters
update webshops
    join (
        select A.id as id, count(B.id) + 1 as C from webshops A
            join webshops B on A.uri = B.uri and A.createdAt > B.createdAt
            group by A.id
    ) as counters on counters.id = webshops.id
    set webshops.uri = concat(webshops.uri, counters.C);

-- Fix duplicate domainUri's
update webshops
    join (
        select A.id as id, count(B.id) + 1 as C from webshops A
            join webshops B on A.domain = B.domain and (A.domainUri = B.domainUri OR A.domainUri is null and B.domainUri is null) and A.createdAt > B.createdAt
            group by A.id
    ) as counters on counters.id = webshops.id
    set webshops.domainUri = concat(webshops.domainUri, counters.C);

ALTER TABLE `webshops`
    CHANGE `uri` `uri` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
    ADD UNIQUE INDEX `uri` (`uri`) USING BTREE,
    ADD UNIQUE INDEX `domain` (`domain`,`domainUri`) USING BTREE;