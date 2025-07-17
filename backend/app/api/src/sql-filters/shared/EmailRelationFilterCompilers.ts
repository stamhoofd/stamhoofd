import { baseModernSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLModernFilterDefinitions, SQLModernValueType } from '@stamhoofd/sql';

export const EmailRelationFilterCompilers = {
    emails: createExistsFilter(
        SQL.select()
            .from(SQL.table('email_recipients'))
            .where(
                SQL.column('objectId'),
                SQL.column('id'), // Parent table id
            ),
        {
            ...baseModernSQLFilterCompilers,
            emailType: createColumnFilter({
                expression: SQL.column('emailType'),
                type: SQLModernValueType.String,
                nullable: false,
            }),
            sentAt: createColumnFilter({
                expression: SQL.column('sentAt'),
                type: SQLModernValueType.Datetime,
                nullable: true,
            }),
        },
    ),
};
