import { baseSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

export const EmailRelationFilterCompilers: SQLFilterDefinitions = new Map([
    ['emails', createExistsFilter(
        SQL.select()
            .from(SQL.table('email_recipients'))
            .where(
                SQL.column('objectId'),
                SQL.column('id'), // Parent table id
            ),
        new Map([
            ...baseSQLFilterCompilers,
            ['emailType', createColumnFilter({
                expression: SQL.column('emailType'),
                type: SQLValueType.String,
                nullable: false,
            })],
            ['sentAt', createColumnFilter({
                expression: SQL.column('sentAt'),
                type: SQLValueType.Datetime,
                nullable: true,
            })],
        ]),
    )],
]);
