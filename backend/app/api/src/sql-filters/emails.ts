import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';

export const emailFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    userId: createColumnFilter({
        expression: SQL.column('userId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    emailType: createColumnFilter({
        expression: SQL.column('emailType'),
        type: SQLValueType.String,
        nullable: true,
    }),
    subject: createColumnFilter({
        expression: SQL.column('subject'),
        type: SQLValueType.String,
        nullable: true,
    }),
    fromAddress: createColumnFilter({
        expression: SQL.column('fromAddress'),
        type: SQLValueType.String,
        nullable: true,
    }),
    text: createColumnFilter({
        expression: SQL.column('text'),
        type: SQLValueType.String,
        nullable: true,
    }),
    status: createColumnFilter({
        expression: SQL.column('status'),
        type: SQLValueType.String,
        nullable: false,
    }),
    recipientStatus: createColumnFilter({
        expression: SQL.column('recipientStatus'),
        type: SQLValueType.String,
        nullable: false,
    }),
    emailRecipientsCount: createColumnFilter({
        expression: SQL.column('emailRecipientsCount'),
        type: SQLValueType.Number,
        nullable: true,
    }),
    createdAt: createColumnFilter({
        expression: SQL.column('createdAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    sentAt: createColumnFilter({
        expression: SQL.column('sentAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
};
