import { baseSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLFilterDefinitions, SQLValueType } from '@stamhoofd/sql';
import { organizationFilterCompilers } from './organizations';

export const baseRegistrationFilterCompilers: SQLFilterDefinitions = {
    ...baseSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLValueType.String,
        nullable: false,
    }),
    /**
     * @deprecated
     */
    price: createColumnFilter({
        expression: SQL.column('price'),
        type: SQLValueType.Number,
        nullable: true,
    }),
    /**
     * @deprecated
     */
    pricePaid: createColumnFilter({
        expression: SQL.column('pricePaid'),
        type: SQLValueType.Number,
        nullable: false,
    }),
    canRegister: createColumnFilter({
        expression: SQL.column('canRegister'),
        type: SQLValueType.Boolean,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    groupId: createColumnFilter({
        expression: SQL.column('groupId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    registeredAt: createColumnFilter({
        expression: SQL.column('registeredAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    periodId: createColumnFilter({
        expression: SQL.column('registrations', 'periodId'),
        type: SQLValueType.String,
        nullable: false,
    }),
    deactivatedAt: createColumnFilter({
        expression: SQL.column('registrations', 'deactivatedAt'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    group: {
        ...baseSQLFilterCompilers,
        id: createColumnFilter({
            expression: SQL.column('groupId'),
            type: SQLValueType.String,
            nullable: false,
        }),
        type: createColumnFilter({
            expression: SQL.column('groups', 'type'),
            type: SQLValueType.String,
            nullable: false,
        }),
        name: createColumnFilter({
            expression: SQL.jsonValue(SQL.column('groups', 'settings'), '$.value.name'),
            type: SQLValueType.JSONString,
            nullable: false,
        }),
        status: createColumnFilter({
            expression: SQL.column('groups', 'status'),
            type: SQLValueType.String,
            nullable: false,
        }),
        defaultAgeGroupId: createColumnFilter({
            expression: SQL.column('groups', 'defaultAgeGroupId'),
            type: SQLValueType.String,
            nullable: true,
        }),
    },
    organization: createExistsFilter(
        SQL.select()
            .from(SQL.table('organizations'))
            .where(
                SQL.column('organizations', 'id'),
                SQL.column('registrations', 'organizationId'),
            ),
        organizationFilterCompilers,
    ),
};
