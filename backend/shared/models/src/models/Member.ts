import { column, Database, ManyToManyRelation, ManyToOneRelation, OneToManyRelation } from '@simonbackx/simple-database';
import { QueryableModel, SQL } from '@stamhoofd/sql';
import { MemberDetails, NationalRegisterNumberOptOut, RegistrationWithTinyMember, TinyMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { Group, MemberResponsibilityRecord, MemberUser, Payment, Registration, User } from './index.js';
export type MemberWithUsers = Member & {
    users: User[];
};
export type MemberWithRegistrations<R extends Registration = Registration> = Member & {
    registrations: (R)[];
};
export type RegistrationWithGroup = Registration & { group: Group };
export type MemberWithRegistrationsAndGroups = MemberWithRegistrations<RegistrationWithGroup>;
export type MemberWithUsersAndRegistrations<R extends Registration = Registration> = MemberWithUsers & MemberWithRegistrations<R>;

/**
 * @deprecated
 * For performance reasons, avoid loading the groups of registrations when not required. Use MemberWithRegistrations instead.
 */
export type MemberWithUsersRegistrationsAndGroups = MemberWithUsers & MemberWithUsersAndRegistrations<RegistrationWithGroup>;

// Defined here to prevent cycles
export type RegistrationWithMember = Registration & { member: Member };

export class Member extends QueryableModel {
    static table = 'members';

    // #region Columns
    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string', nullable: true })
    organizationId: string | null = null;

    @column({
        type: 'string',
        beforeSave: function () {
            return this.details?.firstName ?? '';
        },
    })
    firstName: string;

    @column({ type: 'string',
        beforeSave: function () {
            return this.details?.lastName ?? '';
        } })
    lastName: string;

    @column({
        type: 'string',
        nullable: true,
        beforeSave: function (this: Member) {
            return this.details?.birthDay ? Formatter.dateIso(this.details.birthDay) : null;
        },
    })
    birthDay: string | null;

    @column({
        type: 'string',
        nullable: true,
        beforeSave: function () {
            return this.details?.memberNumber ?? null;
        },
    })
    memberNumber: string | null;

    @column({ type: 'json', decoder: MemberDetails })
    details: MemberDetails;

    /**
     * @deprecated
     * Unreliable since a member can have outstanding balance to multiple organizations now
     */
    @column({ type: 'integer' })
    outstandingBalance = 0;

    @column({
        type: 'datetime', beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
    })
    createdAt: Date;

    @column({
        type: 'datetime', beforeSave() {
            const date = new Date();
            date.setMilliseconds(0);
            return date;
        },
        skipUpdate: true,
    })
    updatedAt: Date;
    // #endregion

    static registrations = new OneToManyRelation(Member, Registration, 'registrations', 'memberId');

    // Note: all relations should point to their parents, not the other way around to avoid reference cycles
    static users = new ManyToManyRelation(Member, User, 'users');

    /**
     * Fetch all members with their corresponding (valid) registration
     */
    static async getWithRegistrations(id: string): Promise<MemberWithUsersRegistrationsAndGroups | null> {
        return (await this.getBlobByIds(id))[0] ?? null;
    }

    /**
     * Fetch all members with their corresponding (valid) registration
     */
    static async getByIdWithRegistrationsAndGroups(id: string): Promise<MemberWithRegistrationsAndGroups | null> {
        const member = await this.getByID(id);
        if (!member) {
            return null;
        }
        await this.loadRegistrations([member], true);
        return member as MemberWithRegistrationsAndGroups;
    }

    /**
     * Fetch all members with their corresponding (valid) registration
     */
    static async getByIdWithUsers(id: string): Promise<MemberWithUsers | null> {
        const member = await this.getByID(id);
        if (!member) {
            return null;
        }
        await this.loadUsers([member]);
        return member as MemberWithUsers;
    }

    /**
     * Fetch all members with their corresponding (valid) registration
     */
    static async getByIdWithUsersAndRegistrations(id: string): Promise<MemberWithUsersAndRegistrations | null> {
        const member = await this.getByID(id);
        if (!member) {
            return null;
        }
        await this.loadRegistrationsAndUsers([member]);
        return member as MemberWithUsersAndRegistrations;
    }

    static async getByIdsWithUsers(...ids: string[]): Promise<MemberWithUsers[]> {
        const members = await Member.getByIDs(...ids);
        return await Member.loadUsers(members);
    }

    /**
     * Fetch all registrations with members with their corresponding (valid) registrations
     */
    static async getRegistrationWithMembersByIDs(ids: string[]): Promise<RegistrationWithMember[]> {
        if (ids.length === 0) {
            return [];
        }

        const registrations = await Registration.getByIDs(...ids);
        await this.loadMembersForRegistrations(registrations);
        return registrations as RegistrationWithMember[];
    }

    /**
     * Fetch all registrations with members with their corresponding (valid) registrations
     */
    static async loadMembersForRegistrations(registrations: Registration[]): Promise<RegistrationWithMember[]> {
        if (registrations.length === 0) {
            return [];
        }

        const memberIds = Formatter.uniqueArray(registrations.map(r => r.memberId));
        if (memberIds.length) {
            // In the future we might add a 'reverse' method on manytoone relation, instead of defining the new relation. But then we need to store 2 model types in the many to one relation.
            const registrationMemberRelation = new ManyToOneRelation(Member, 'member');
            registrationMemberRelation.foreignKey = Member.registrations.foreignKey;

            const members = await Member.getByIDs(...memberIds);
            for (const registration of registrations) {
                const member = members.find(m => m.id === registration.memberId);
                if (member) {
                    registration.setRelation(registrationMemberRelation, member);
                }
                else {
                    throw new Error('Unexpected missing member for registration ' + registration.id);
                }
            }
        }

        return registrations as RegistrationWithMember[];
    }

    /**
     * Fetch all registrations with members with their corresponding (valid) registrations
     */
    static async getRegistrationWithMembersForGroup(groupId: string): Promise<RegistrationWithMember[]> {
        const registrations = await Registration.select()
            .where('groupId', groupId)
            .where('registeredAt', '!=', null)
            .where('deactivatedAt', null)
            .fetch();

        return this.loadMembersForRegistrations(registrations);
    }

    static async loadRegistrations(members: Member[], withGroups?: false): Promise<MemberWithRegistrations[]>;
    static async loadRegistrations(members: Member[], withGroups: true): Promise<MemberWithRegistrationsAndGroups[]>;
    static async loadRegistrations(members: Member[], withGroups: boolean | undefined = true): Promise<MemberWithRegistrations[] | MemberWithRegistrationsAndGroups[]> {
        if (members.length === 0) {
            return members as MemberWithRegistrations[];
        }

        // Load relations
        // Load registrations of these members
        const loadAllFor: string[] = [];
        const alreadyLoadedRegistrations: (Registration | undefined)[] = [];

        for (const member of members) {
            if ('registrations' in member && Array.isArray(member.registrations)) {
                if (member.registrations.length === 0) {
                    // Nothing to do
                    continue;
                }

                alreadyLoadedRegistrations.push(...member.registrations as Registration[]);
                continue;
            }
            loadAllFor.push(member.id);
        }

        const ids = Formatter.uniqueArray(loadAllFor);
        if (ids.length) {
            const registrations = await Registration.select()
                .where('memberId', ids)
                .where(
                    SQL.where('registeredAt', '!=', null),
                )
                .fetch() as (Registration | undefined)[];
            alreadyLoadedRegistrations.push(...registrations);
        }
        else {
            if (!withGroups) {
                return members as MemberWithRegistrations[];
            }
        }

        if (withGroups) {
            const groupIds = Formatter.uniqueArray(alreadyLoadedRegistrations.map(r => r && 'group' in r ? undefined : r?.groupId));
            if (groupIds.length) {
                const groups = await Group.getByIDs(...groupIds);

                for (const [index, registration] of alreadyLoadedRegistrations.entries()) {
                    if ('group' in registration!) {
                        continue;
                    }
                    const group = groups.find(g => g.id === registration!.groupId);
                    if (group && !group.deletedAt) {
                        registration!.setRelation(Registration.group, group);
                    }
                    else {
                        // Remove registration from list
                        alreadyLoadedRegistrations[index] = undefined;
                    }
                }
            }
            else {
                if (ids.length === 0) {
                    // Nothing loaded
                    return members as MemberWithRegistrations[];
                }
            }
        }

        for (const member of members) {
            // Add registrations
            const memberRegistrations = alreadyLoadedRegistrations.filter(r => !!r && r.memberId === member.id) as Registration[];
            member.setManyRelation(Member.registrations, memberRegistrations);
        }

        return members as MemberWithRegistrations[];
    }

    static async loadUsers(members: Member[]): Promise<MemberWithUsers[]> {
        // Load relations
        // Load registrations of these members
        const ids = Formatter.uniqueArray(members.map(m => ('users' in m) ? undefined : m.id));
        if (ids.length === 0) {
            return members as MemberWithUsers[];
        }

        const users = await User.select(
            SQL.wildcard(User.table),
            SQL.column(MemberUser.table, 'membersId'),
        )
            .join(
                SQL.join(MemberUser.table)
                    .where(
                        SQL.parentColumn('id'),
                        SQL.column('usersId'),
                    ),
            )
            .where(SQL.column(MemberUser.table, 'membersId'), ids)
            .fetch();

        for (const member of members) {
            if ('users' in member) {
                // Was already loaded
                continue;
            }
            // Add registrations
            // Add users
            const memberUsers = users.filter((u) => {
                const memberId = u.rawSelectedRow?.[MemberUser.table]?.['membersId'];
                if (memberId) {
                    return memberId === member.id;
                }
                return false;
            });
            member.setManyRelation(Member.users, memberUsers);
        }

        return members as MemberWithUsers[];
    }

    static unloadUsers(members: Member[]) {
        for (const member of members) {
            if ('users' in member) {
                delete member.users;
            }
        }
    }

    static unloadRegistrations(members: Member[]) {
        for (const member of members) {
            if ('registrations' in member) {
                delete member.registrations;
            }
        }
    }

    /**
     * Fetch all members with their corresponding (valid) registrations, users
     */
    static async loadRegistrationsAndUsers(members: Member[], withGroups?: false): Promise<MemberWithUsersAndRegistrations[]>;
    static async loadRegistrationsAndUsers(members: Member[], withGroups: true): Promise<MemberWithUsersRegistrationsAndGroups[]>;
    static async loadRegistrationsAndUsers(members: Member[], withGroups: boolean | undefined = true): Promise<MemberWithUsersAndRegistrations[] | MemberWithUsersRegistrationsAndGroups[]> {
        await this.loadRegistrations(members, withGroups as true);
        await this.loadUsers(members);
        return members as MemberWithUsersAndRegistrations[];
    }

    /**
     * Fetch all members with their corresponding (valid) registrations, users
     */
    static async getBlobByIds(...ids: string[]): Promise<MemberWithUsersRegistrationsAndGroups[]> {
        if (ids.length == 0) {
            return [];
        }

        const baseMembers = await this.getByIDs(...ids);

        if (baseMembers.length === 0) {
            return [];
        }

        await this.loadRegistrationsAndUsers(baseMembers, true);
        return baseMembers as MemberWithUsersRegistrationsAndGroups[];
    }

    /**
     * Fetch all members with their corresponding (valid) registrations and payment
     */
    static async getFamily(id: string): Promise<Member[]> {
        const results = await SQL.select(
            SQL.column('l2', 'membersId'),
        )
            .from('_members_users', 'l1')
            .join(
                SQL.join('_members_users', 'l2')
                    .where(
                        SQL.column('l2', 'usersId'),
                        SQL.column('l1', 'usersId'),
                    ),
            )
            .where(
                SQL.column('l1', 'membersId'),
                id,
            )
            .groupBy(SQL.column('l2', 'membersId'))
            .fetch();

        const ids: string[] = [];
        for (const row of results) {
            ids.push(row['l2']['membersId'] as string);
        }

        if (!ids.includes(id)) {
            // Member has no users
            ids.push(id);
        }

        return await this.getByIDs(...ids);
    }

    /**
     * @deprecated Please avoid implicit relation loading and only load the rel
     * Fetch all members with their corresponding (valid) registrations and payment
     */
    static async getFamilyWithRegistrations(id: string): Promise<MemberWithUsersRegistrationsAndGroups[]> {
        const members = await this.getFamily(id);
        return await this.loadRegistrationsAndUsers(members, true);
    }

    /**
     * Fetch all members with their corresponding (valid) registrations or waiting lists and payments
     */
    static async getMemberIdsForUser(user: User): Promise<string[]> {
        const query = SQL
            .select('membersId')
            .from('_members_users')
            .where('usersId', user.id);

        const data = await query.fetch();
        return Formatter.uniqueArray(data.map(r => r._members_users.membersId as string));
    }

    /**
     * Fetch all members with their corresponding (valid) registrations or waiting lists and payments
     */
    static async getMembersForUser(user: User): Promise<Member[]> {
        return this.getByIDs(...(await this.getMemberIdsForUser(user)));
    }

    /**
     * @deprecated Use getMembersForUser and load relations as needed
     * Fetch all members with their corresponding (valid) registrations or waiting lists and payments
     */
    static async getMembersWithRegistrationForUser(user: User): Promise<MemberWithUsersRegistrationsAndGroups[]> {
        return this.getBlobByIds(...(await this.getMemberIdsForUser(user)));
    }

    static getRegistrationWithTinyMemberStructure(registration: RegistrationWithMember & { group: import('./Group').Group }): RegistrationWithTinyMember {
        return RegistrationWithTinyMember.create({
            ...registration.getStructure(),
            cycle: registration.cycle,
            member: TinyMember.create({
                id: registration.member.id,
                firstName: registration.member.firstName,
                lastName: registration.member.lastName,
            }),
        });
    }

    async isSafeToMergeDuplicateWithoutSecurityCode() {
        if (this.details.recordAnswers.size > 0) {
            return false;
        }

        if (this.details.parents.length > 0) {
            return false;
        }

        if (this.details.emergencyContacts.length > 0) {
            return false;
        }

        if (this.details.uitpasNumberDetails) {
            return false;
        }

        if (this.details.nationalRegisterNumber !== null && this.details.nationalRegisterNumber !== NationalRegisterNumberOptOut) {
            return false;
        }

        if (this.details.requiresFinancialSupport !== null) {
            return false;
        }

        if (this.details.address || this.details.phone || this.details.email || this.details.alternativeEmails.length > 0 || this.details.unverifiedAddresses.length > 0 || this.details.unverifiedPhones.length > 0 || this.details.unverifiedEmails.length > 0) {
            return false;
        }

        // If responsibilities: not safe
        const responsibilities = await MemberResponsibilityRecord.where({ memberId: this.id }, { limit: 1 });
        if (responsibilities.length > 0) {
            return false;
        }

        return true;
    }
}
