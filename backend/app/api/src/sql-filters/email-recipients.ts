import { baseSQLFilterCompilers, createColumnFilter, SQL, SQLConcat, SQLFilterDefinitions, SQLScalar, SQLValueType } from '@stamhoofd/sql';

export const emailRecipientsFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    email: createColumnFilter({
        expression: SQL.column('email'),
        type: SQLValueType.String,
        nullable: true,
    }),
    name: createColumnFilter({
        expression: new SQLConcat(
            SQL.column('firstName'),
            new SQLScalar(' '),
            SQL.column('lastName'),
        ),
        type: SQLValueType.String,
        nullable: true,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    emailId: createColumnFilter({
        expression: SQL.column('emailId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    sentAt: createColumnFilter({
        expression: SQL.column('sentAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    failError: createColumnFilter({
        expression: SQL.column('failError'),
        type: SQLValueType.JSONObject,
        nullable: true,
    }),
    spamComplaintError: createColumnFilter({
        expression: SQL.column('spamComplaintError'),
        type: SQLValueType.String,
        nullable: true,
    }),
    softBounceError: createColumnFilter({
        expression: SQL.column('softBounceError'),
        type: SQLValueType.String,
        nullable: true,
    }),
    hardBounceError: createColumnFilter({
        expression: SQL.column('hardBounceError'),
        type: SQLValueType.String,
        nullable: true,
    }),
};
