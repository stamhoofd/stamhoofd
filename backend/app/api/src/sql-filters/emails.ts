import { baseSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';
import { emailRecipientsFilterCompilers } from './email-recipients.js';

export const userEmailFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    sentAt: createColumnFilter({
        expression: SQL.column('sentAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    senderId: createColumnFilter({
        expression: SQL.column('senderId'),
        type: SQLValueType.String,
        nullable: true,
    }),
};

export const emailFilterCompilers: SQLFilterDefinitions = {
    ...userEmailFilterCompilers,
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
    failedCount: createColumnFilter({
        expression: SQL.column('failedCount'),
        type: SQLValueType.Number,
        nullable: false,
    }),
    softFailedCount: createColumnFilter({
        expression: SQL.column('softFailedCount'),
        type: SQLValueType.Number,
        nullable: false,
    }),
    hardBouncesCount: createColumnFilter({
        expression: SQL.column('hardBouncesCount'),
        type: SQLValueType.Number,
        nullable: false,
    }),
    softBouncesCount: createColumnFilter({
        expression: SQL.column('softBouncesCount'),
        type: SQLValueType.Number,
        nullable: false,
    }),
    spamComplaintsCount: createColumnFilter({
        expression: SQL.column('spamComplaintsCount'),
        type: SQLValueType.Number,
        nullable: false,
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
    senderId: createColumnFilter({
        expression: SQL.column('senderId'),
        type: SQLValueType.String,
        nullable: true,
    }),
    deletedAt: createColumnFilter({
        expression: SQL.column('deletedAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    recipients: createExistsFilter(
        SQL.select()
            .from(
                SQL.table('email_recipients'),
            )
            .where(
                SQL.column('emailId'),
                SQL.parentColumn('id'),
            ),
        {
            ...emailRecipientsFilterCompilers,
        },
    ),
};
