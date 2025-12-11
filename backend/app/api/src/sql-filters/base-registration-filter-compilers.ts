import { SimpleError } from '@simonbackx/simple-errors';
import { baseSQLFilterCompilers, createColumnFilter, createExistsFilter, createJoinedRelationFilter, SQL, SQLFilterDefinitions, SQLIfNull, SQLValueType } from '@stamhoofd/sql';
import { FilterWrapperMarker, PermissionLevel, StamhoofdFilter, unwrapFilter } from '@stamhoofd/structures';
import { Context } from '../helpers/Context.js';
import { cachedBalanceGroupedJoin } from '../helpers/outstandingBalanceJoin.js';
import { SQLTranslatedString } from '../helpers/SQLTranslatedString.js';
import { organizationFilterCompilers } from './organizations.js';

async function checkGroupIdFilterAccess(filter: StamhoofdFilter, permissionLevel: PermissionLevel) {
    const groupIds = typeof filter === 'string'
        ? [filter]
        : unwrapFilter(filter as StamhoofdFilter, {
            $in: FilterWrapperMarker,
        })?.markerValue;

    if (!Array.isArray(groupIds)) {
        throw new SimpleError({
            code: 'invalid_field',
            field: 'filter',
            message: 'You must filter on a group of the organization you are trying to access',
            human: $t(`d0ef2e12-dfa2-4d2a-9ee7-793e52e6b94f`),
        });
    }

    if (groupIds.length === 0) {
        return;
    }

    for (const groupId of groupIds) {
        if (typeof groupId !== 'string') {
            throw new SimpleError({
                code: 'invalid_field',
                field: 'filter',
                message: 'Invalid group ID in filter',
            });
        }
    }

    const groups = await Context.auth.getGroups(groupIds as string[]);

    console.log('Filtering registrations on groups', groups.map(g => g.settings.name.toString()));

    for (const group of groups) {
        if (!await Context.auth.canAccessGroup(group, permissionLevel)) {
            if (permissionLevel === PermissionLevel.Read && group.settings.implicitlyAllowViewRegistrations) {
                // Allowed to filter on this group, since we have view access.
                continue;
            }
            throw Context.auth.error({
                message: 'You do not have access to this group',
                human: $t(`45eedf49-0f0a-442c-a0bd-7881c2682698`, { groupName: group.settings.name }),
            });
        }
    }

    return;
}

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
    groupPrice: createColumnFilter({
        expression: new SQLTranslatedString(SQL.column('groupPrice'), '$.value.name'),
        type: SQLValueType.String,
        nullable: true,
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
        async checkPermission(filter) {
            await checkGroupIdFilterAccess(filter, PermissionLevel.Read);
        },
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
    trialUntil: createColumnFilter({
        expression: SQL.column('registrations', 'trialUntil'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    startDate: createColumnFilter({
        expression: SQL.column('registrations', 'startDate'),
        type: SQLValueType.Datetime,
        nullable: true,
    }),
    group: {
        ...baseSQLFilterCompilers,
        id: createColumnFilter({
            expression: SQL.column('groupId'),
            type: SQLValueType.String,
            nullable: false,
            async checkPermission(filter) {
                await checkGroupIdFilterAccess(filter, PermissionLevel.Read);
            },
        }),
        type: createColumnFilter({
            expression: SQL.column('groups', 'type'),
            type: SQLValueType.String,
            nullable: false,
        }),
        name: createColumnFilter({
            expression: SQL.jsonExtract(SQL.column('groups', 'settings'), '$.value.name'),
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
    cachedBalance: createJoinedRelationFilter(
        cachedBalanceGroupedJoin,
        {
            amountOpen: createColumnFilter({
                expression: new SQLIfNull(SQL.column('cb', 'amountOpen'), 0),
                type: SQLValueType.Number,
                nullable: false,
            }),
        },
    ),
};
