import { baseSQLFilterCompilers, createSQLColumnFilterCompiler, SQLFilterDefinitions } from '@stamhoofd/sql';

export const auditLogFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createSQLColumnFilterCompiler('id'),
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    type: createSQLColumnFilterCompiler('type'),
    objectId: createSQLColumnFilterCompiler('objectId'),
    createdAt: createSQLColumnFilterCompiler('createdAt'),
};
