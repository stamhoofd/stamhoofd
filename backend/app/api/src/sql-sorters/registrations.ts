import { Group, Member, Organization } from '@stamhoofd/models';
import { SQL, SQLIfNull, SQLOrderBy, SQLOrderByDirection, SQLSortDefinitions } from '@stamhoofd/sql';
import { MemberWithRegistrationsBlob, Organization as OrganizationStruct, RegistrationWithMemberBlob } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { memberCachedBalanceForOrganizationJoin, registrationCachedBalanceJoin } from '../helpers/outstandingBalanceJoin.js';
import { SQLTranslatedString } from '../helpers/SQLTranslatedString.js';
import { groupJoin, memberJoin, organizationJoin } from '../sql-filters/registrations.js';

export class RegistrationSortData {
    readonly registration: RegistrationWithMemberBlob;
    private organizations: OrganizationStruct[];

    constructor({ registration, organizations }: { registration: RegistrationWithMemberBlob; organizations: OrganizationStruct[] }) {
        this.registration = registration;
        this.organizations = organizations;
    }

    get organization() {
        const organization = this.organizations.find(o => o.id === this.registration.organizationId);
        if (!organization) {
            throw new Error('Organization not found for registration');
        }

        return organization;
    }
}

export const registrationSorters: SQLSortDefinitions<RegistrationSortData> = {
    // WARNING! TEST NEW SORTERS THOROUGHLY!
    // Try to avoid creating sorters on fields that er not 1:1 with the database, that often causes pagination issues if not thought through
    // An example: sorting on 'name' is not a good idea, because it is a concatenation of two fields.
    // You might be tempted to use ORDER BY firstName, lastName, but that will not work as expected and it needs to be ORDER BY CONCAT(firstName, ' ', lastName)
    // Why? Because ORDER BY firstName, lastName produces a different order dan ORDER BY CONCAT(firstName, ' ', lastName) if there are multiple people with spaces in the first name
    // And that again causes issues with pagination because the next query will append a filter of name > 'John Doe' - causing duplicate and/or skipped results
    // What if you need mapping? simply map the sorters in the frontend: name -> firstname, lastname, age -> birthDay, etc.

    'id': {
        getValue({ registration }) {
            return registration.id;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('id'),
                direction,
            });
        },
    },
    'registeredAt': {
        getValue({ registration }) {
            return registration.registeredAt;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('registeredAt'),
                direction,
            });
        },
    },
    'groupPrice': {
        getValue: ({ registration }) => registration.groupPrice.name.toString(),
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: new SQLTranslatedString(SQL.column('groupPrice'), '$.value.name'),
                direction,
            });
        },
    },
    'trialUntil': {
        getValue({ registration }) {
            return registration.trialUntil;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('trialUntil'),
                direction,
            });
        },
    },
    'startDate': {
        getValue({ registration }) {
            return registration.startDate;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column('startDate'),
                direction,
            });
        },
    },
    'memberCachedBalance.amountOpen': {
        getValue({ registration }) {
            return registration.member.balances.reduce((sum, r) => sum + (r.amountOpen), 0);
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: new SQLIfNull(SQL.column('memberCachedBalance', 'amountOpen'), 0),
                direction,
            });
        },
        join: memberCachedBalanceForOrganizationJoin,
        select: [SQL.column('memberCachedBalance', 'amountOpen')],
    },
    'registrationCachedBalance.toPay': {
        getValue({ registration }) {
            return registration.balances.reduce((sum, r) => sum + (r.amountOpen + r.amountPending), 0);
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: new SQLIfNull(SQL.column('registrationCachedBalance', 'toPay'), 0),
                direction,
            });
        },
        join: registrationCachedBalanceJoin,
        select: [SQL.column('registrationCachedBalance', 'toPay')],
    },
    'registrationCachedBalance.price': {
        getValue({ registration }) {
            return registration.balances.reduce((sum, r) => sum + (r.amountOpen + r.amountPaid + r.amountPending), 0);
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: new SQLIfNull(SQL.column('registrationCachedBalance', 'price'), 0),
                direction,
            });
        },
        join: registrationCachedBalanceJoin,
        select: [SQL.column('registrationCachedBalance', 'price')],
    },
    'member.memberNumber': createMemberColumnSorter({
        columnName: 'memberNumber',
        getValue: member => member.details.memberNumber ?? '',

    }),
    'member.firstName': {
        getValue({ registration }) {
            return registration.member.firstName;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column(Member.table, 'firstName'),
                direction,
            });
        },
        join: memberJoin,
        select: [SQL.column(Member.table, 'firstName')],
    },
    'member.lastName': {
        getValue({ registration }) {
            return registration.member.lastName;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column(Member.table, 'lastName'),
                direction,
            });
        },
        join: memberJoin,
        select: [SQL.column(Member.table, 'lastName')],
    },
    'member.birthDay': {
        getValue({ registration }) {
            return registration.member.details.birthDay === null ? null : Formatter.dateIso(registration.member.details.birthDay);
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column(Member.table, 'birthDay'),
                direction,
            });
        },
        join: memberJoin,
        select: [SQL.column(Member.table, 'birthDay')],
    },
    'member.createdAt': {
        getValue({ registration }) {
            return registration.member.createdAt;
        },
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column(Member.table, 'createdAt'),
                direction,
            });
        },
        join: memberJoin,
        select: [SQL.column(Member.table, 'createdAt')],
    },
    'organization.name': {
        getValue: ({ organization }) => organization.name,
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column(Organization.table, 'name'),
                direction,
            });
        },
        join: organizationJoin,
        select: [SQL.column(Organization.table, 'name')],
    },
    'organization.uri': {
        getValue: ({ organization }) => organization.uri,
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column(Organization.table, 'uri'),
                direction,
            });
        },
        join: organizationJoin,
        select: [SQL.column(Organization.table, 'uri')],
    },
    'group.name': {
        getValue: ({ registration }) => registration.group.settings.name.toString(),
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: new SQLTranslatedString(SQL.column(Group.table, 'settings'), '$.value.name'),
                direction,
            });
        },
        join: groupJoin,
    },
};

/**
 * Helper function for simple sort on member column
 * @param param0
 * @returns
 */
function createMemberColumnSorter<T>({ columnName, getValue }: { columnName: string; getValue: (member: MemberWithRegistrationsBlob) => T }) {
    return {
        getValue: ({ registration }: RegistrationSortData) => getValue(registration.member),
        toSQL: (direction: SQLOrderByDirection): SQLOrderBy => {
            return new SQLOrderBy({
                column: SQL.column(Member.table, columnName),
                direction,
            });
        },
        join: memberJoin,
        select: [SQL.column(Member.table, columnName)],
    };
}
