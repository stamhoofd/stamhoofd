import { Database, Migration } from '@simonbackx/simple-database';
export default new Migration(async () => {
    if (STAMHOOFD.environment === 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.userMode === 'platform') {
        console.log('skipped for userMode platform');
        return;
    }

    console.log('start create v1_groups_migration_data table');

    // create table to keep track of which combination of group id and cycle has been migrated to a new group after the migration from Stamhoofd v1 to v2
    const groupsQuery = `CREATE TABLE \`v1_groups_migration_data\` (
        \`newGroupId\` varchar(36) NOT NULL,
        \`oldGroupId\` varchar(36) NOT NULL,
        \`oldCycle\` int NOT NULL DEFAULT '0',
    PRIMARY KEY (\`newGroupId\`),
    UNIQUE KEY \`oldKey\` (\`oldGroupId\`,\`oldCycle\`) USING BTREE,
    CONSTRAINT \`v1_groups_migration_data_ibfk_1\` FOREIGN KEY (\`newGroupId\`) REFERENCES \`groups\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`;

    await Database.statement(groupsQuery);
    console.log('finished create v1_groups_migration_data table');

    console.log('start create v1_waiting_list_migration_data table');
    // create table to keep track of which combination of waiting list group id and cycle has been migrated to a new group after the migration from Stamhoofd v1 to v2
    const waitingListsQuery = `CREATE TABLE \`v1_waiting_list_migration_data\` (
        \`newGroupId\` varchar(36) NOT NULL,
        \`oldGroupId\` varchar(36) NOT NULL,
        \`oldCycle\` int NOT NULL DEFAULT '0',
    PRIMARY KEY (\`newGroupId\`),
    UNIQUE KEY \`oldKey\` (\`oldGroupId\`,\`oldCycle\`) USING BTREE,
    CONSTRAINT \`v1_waiting_list_migration_data_ibfk_1\` FOREIGN KEY (\`newGroupId\`) REFERENCES \`groups\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`;
    await Database.statement(waitingListsQuery);

    console.log('finished create v1_waiting_list_migration_data table');
});

// CREATE TABLE `v1_groups_migration_data` (
//     `newGroupId` varchar(36) NOT NULL,
//     `oldGroupId` varchar(36) NOT NULL,
//     `oldCycle` int NOT NULL DEFAULT '0',
//   PRIMARY KEY (`newGroupId`),
//   UNIQUE KEY `oldKey` (`oldGroupId`,`oldCycle`) USING BTREE,
//   CONSTRAINT `groups_ibfk_1` FOREIGN KEY (`newGroupId`) REFERENCES `groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
// ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
