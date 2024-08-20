ALTER TABLE `organizations`
ADD INDEX tags ((
    CAST(meta->'$.value.tags' AS CHAR(36) ARRAY)
)) USING BTREE;
