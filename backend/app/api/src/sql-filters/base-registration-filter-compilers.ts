import { baseModernSQLFilterCompilers, createColumnFilter, createExistsFilter, SQL, SQLModernFilterDefinitions, SQLModernValueType } from '@stamhoofd/sql';
import { organizationFilterCompilers } from './organizations';

export const baseRegistrationFilterCompilers: SQLModernFilterDefinitions = {
    ...baseModernSQLFilterCompilers,
    id: createColumnFilter({
        expression: SQL.column('id'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    /**
     * @deprecated
     */
    price: createColumnFilter({
        expression: SQL.column('price'),
        type: SQLModernValueType.Number,
        nullable: true,
    }),
    /**
     * @deprecated
     */
    pricePaid: createColumnFilter({
        expression: SQL.column('pricePaid'),
        type: SQLModernValueType.Number,
        nullable: false,
    }),
    canRegister: createColumnFilter({
        expression: SQL.column('canRegister'),
        type: SQLModernValueType.Boolean,
        nullable: false,
    }),
    organizationId: createColumnFilter({
        expression: SQL.column('organizationId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    groupId: createColumnFilter({
        expression: SQL.column('groupId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    registeredAt: createColumnFilter({
        expression: SQL.column('registeredAt'),
        type: SQLModernValueType.Datetime,
        nullable: true,
    }),
    periodId: createColumnFilter({
        expression: SQL.column('registrations', 'periodId'),
        type: SQLModernValueType.String,
        nullable: false,
    }),
    deactivatedAt: createColumnFilter({
        expression: SQL.column('registrations', 'deactivatedAt'),
        type: SQLModernValueType.Datetime,
        nullable: true,
    }),
    group: {
        ...baseModernSQLFilterCompilers,
        id: createColumnFilter({
            expression: SQL.column('groupId'),
            type: SQLModernValueType.String,
            nullable: false,
        }),
        type: createColumnFilter({
            expression: SQL.column('groups', 'type'),
            type: SQLModernValueType.String,
            nullable: false,
        }),
        name: createColumnFilter({
            expression: SQL.jsonValue(SQL.column('groups', 'settings'), '$.value.name'),
            type: SQLModernValueType.JSONString,
            nullable: false,
        }),
        status: createColumnFilter({
            expression: SQL.column('groups', 'status'),
            type: SQLModernValueType.String,
            nullable: false,
        }),
        defaultAgeGroupId: createColumnFilter({
            expression: SQL.column('groups', 'defaultAgeGroupId'),
            type: SQLModernValueType.String,
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
