import { createSQLRelationFilterCompiler, SQL, SQLParentNamespace, baseSQLFilterCompilers, createSQLColumnFilterCompiler } from '@stamhoofd/sql';

export const EmailRelationFilterCompilers = {
    emails: createSQLRelationFilterCompiler(
        SQL.select()
            .from(
                SQL.table('email_recipients'),
            )
            .where(
                SQL.column(SQLParentNamespace, 'id'),
                SQL.column('objectId'),
            ),
        {
            ...baseSQLFilterCompilers,
            emailType: createSQLColumnFilterCompiler('emailType'),
            sentAt: createSQLColumnFilterCompiler('sentAt'),
        },
    ),
};
