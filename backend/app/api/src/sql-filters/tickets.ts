import { baseSQLFilterCompilers, createSQLColumnFilterCompiler, SQLFilterDefinitions } from '@stamhoofd/sql';

export const ticketFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    organizationId: createSQLColumnFilterCompiler('organizationId'),
    updatedAt: createSQLColumnFilterCompiler('updatedAt'),
    webshopId: createSQLColumnFilterCompiler('webshopId'),
    id: createSQLColumnFilterCompiler('id'),
    createdAt: createSQLColumnFilterCompiler('createdAt'),
};
