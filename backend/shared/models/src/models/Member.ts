import { column, Database, ManyToManyRelation, ManyToOneRelation, OneToManyRelation } from '@simonbackx/simple-database';
import { QueryableModel, SQL } from '@stamhoofd/sql';
import { MemberDetails, NationalRegisterNumberOptOut, RegistrationWithTinyMember, TinyMember } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';

import { Group, MemberResponsibilityRecord, Payment, Registration, User } from './';
export type MemberWithUsers = Member & {
    users: User[];
};
export type MemberWithRegistrations = MemberWithUsers & {
    registrations: (Registration & { group: Group })[];
};

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
    static async getWithRegistrations(id: string): Promise<MemberWithRegistrations | null> {
        return (await this.getBlobByIds(id))[0] ?? null;
    }

    /**
     * Fetch all registrations with members with their corresponding (valid) registrations
     */
    static async getRegistrationWithMembersByIDs(ids: string[]): Promise<RegistrationWithMember[]> {
        if (ids.length === 0) {
            return [];
        }
        let query = `SELECT ${Member.getDefaultSelect()}, ${Registration.getDefaultSelect()} from \`${Member.table}\`\n`;

        query += `JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\` AND (\`${Registration.table}\`.\`registeredAt\` is not null OR \`${Registration.table}\`.\`canRegister\` = 1)\n`;

        // We do an extra join because we also need to get the other registrations of each member (only one regitration has to match the query)
        query += `where \`${Registration.table}\`.\`${Registration.primary.name}\` IN (?)`;

        const [results] = await Database.select(query, [ids]);
        const registrations: RegistrationWithMember[] = [];

        // In the future we might add a 'reverse' method on manytoone relation, instead of defining the new relation. But then we need to store 2 model types in the many to one relation.
        const registrationMemberRelation = new ManyToOneRelation(Member, 'member');
        registrationMemberRelation.foreignKey = Member.registrations.foreignKey;

        for (const row of results) {
            const registration = Registration.fromRow(row[Registration.table]);
            if (!registration) {
                throw new Error('Expected registration in every row');
            }

            const foundMember = Member.fromRow(row[Member.table]);
            if (!foundMember) {
                throw new Error('Expected member in every row');
            }

            const _f = registration.setRelation(registrationMemberRelation, foundMember);
            registrations.push(_f);
        }

        return registrations;
    }

    /**
     * Fetch all registrations with members with their corresponding (valid) registrations
     */
    static async getRegistrationWithMembersForGroup(groupId: string): Promise<RegistrationWithMember[]> {
        let query = `SELECT ${Member.getDefaultSelect()}, ${Registration.getDefaultSelect()} from \`${Member.table}\`\n`;

        query += `JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\` AND \`${Registration.table}\`.\`registeredAt\` is not null AND \`${Registration.table}\`.\`deactivatedAt\` is null\n`;

        // We do an extra join because we also need to get the other registrations of each member (only one regitration has to match the query)
        query += `where \`${Registration.table}\`.\`groupId\` = ?`;

        const [results] = await Database.select(query, [groupId]);
        const registrations: RegistrationWithMember[] = [];

        // In the future we might add a 'reverse' method on manytoone relation, instead of defining the new relation. But then we need to store 2 model types in the many to one relation.
        const registrationMemberRelation = new ManyToOneRelation(Member, 'member');
        registrationMemberRelation.foreignKey = Member.registrations.foreignKey;

        for (const row of results) {
            const registration = Registration.fromRow(row[Registration.table]);
            if (!registration) {
                throw new Error('Expected registration in every row');
            }

            const foundMember = Member.fromRow(row[Member.table]);
            if (!foundMember) {
                throw new Error('Expected member in every row');
            }

            const _f = registration.setRelation(registrationMemberRelation, foundMember);
            registrations.push(_f);
        }

        return registrations;
    }

    /**
     * Fetch all registrations with members with their corresponding (valid) registrations and payment
     */
    static async getRegistrationWithMembersForPayment(paymentId: string): Promise<RegistrationWithMember[]> {
        const { BalanceItem, BalanceItemPayment } = await import('./');

        let query = `SELECT ${Member.getDefaultSelect()}, ${Registration.getDefaultSelect()} from \`${Member.table}\`\n`;

        query += `JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\`\n`;

        query += `LEFT JOIN \`${BalanceItem.table}\` ON \`${BalanceItem.table}\`.\`registrationId\` = \`${Registration.table}\`.\`${Registration.primary.name}\`\n`;
        query += `LEFT JOIN \`${BalanceItemPayment.table}\` ON \`${BalanceItemPayment.table}\`.\`${BalanceItemPayment.balanceItem.foreignKey}\` = \`${BalanceItem.table}\`.\`${BalanceItem.primary.name}\`\n`;
        query += `JOIN \`${Payment.table}\` ON \`${Payment.table}\`.\`${Payment.primary.name}\` = \`${BalanceItemPayment.table}\`.\`${BalanceItemPayment.payment.foreignKey}\`\n`;

        // We do an extra join because we also need to get the other registrations of each member (only one regitration has to match the query)
        query += `WHERE \`${Payment.table}\`.\`${Payment.primary.name}\` = ?\n`;
        query += `GROUP BY \`${Registration.table}\`.\`${Registration.primary.name}\`, \`${Member.table}\`.\`${Member.primary.name}\``;

        const [results] = await Database.select(query, [paymentId]);
        const registrations: RegistrationWithMember[] = [];

        // In the future we might add a 'reverse' method on manytoone relation, instead of defining the new relation. But then we need to store 2 model types in the many to one relation.
        const registrationMemberRelation = new ManyToOneRelation(Member, 'member');
        registrationMemberRelation.foreignKey = Member.registrations.foreignKey;

        for (const row of results) {
            const registration = Registration.fromRow(row[Registration.table]);
            if (!registration) {
                throw new Error('Expected registration in every row');
            }

            const foundMember = Member.fromRow(row[Member.table]);
            if (!foundMember) {
                throw new Error('Expected member in every row');
            }

            const _f = registration.setRelation(registrationMemberRelation, foundMember);
            registrations.push(_f);
        }

        return registrations;
    }

    /**
     * Fetch all members with their corresponding (valid) registrations, users
     */
    static async getBlobByIds(...ids: string[]): Promise<MemberWithRegistrations[]> {
        if (ids.length == 0) {
            return [];
        }
        let query = `SELECT ${Member.getDefaultSelect()}, ${Registration.getDefaultSelect()}, ${User.getDefaultSelect()}  from \`${Member.table}\`\n`;
        query += `LEFT JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\` AND (\`${Registration.table}\`.\`registeredAt\` is not null OR \`${Registration.table}\`.\`canRegister\` = 1)\n`;
        query += Member.users.joinQuery(Member.table, User.table) + '\n';

        // We do an extra join because we also need to get the other registrations of each member (only one regitration has to match the query)
        query += `where \`${Member.table}\`.\`${Member.primary.name}\` IN (?)`;

        const [results] = await Database.select(query, [ids]);
        const members: MemberWithRegistrations[] = [];

        // Load groups
        const groupIds = results.map(r => r[Registration.table]?.groupId).filter(id => id) as string[];
        const groups = await Group.getByIDs(...Formatter.uniqueArray(groupIds));

        for (const row of results) {
            const foundMember = Member.fromRow(row[Member.table]);
            if (!foundMember) {
                throw new Error('Expected member in every row');
            }
            const _f = foundMember
                .setManyRelation(Member.registrations as unknown as OneToManyRelation<'registrations', Member, Registration & { group: Group }>, [])
                .setManyRelation(Member.users, []);

            // Seach if we already got this member?
            const existingMember = members.find(m => m.id == _f.id);

            const member: MemberWithRegistrations = (existingMember ?? _f);
            if (!existingMember) {
                members.push(member);
            }

            // Check if we have a registration with a payment
            const registration = Registration.fromRow(row[Registration.table]);
            if (registration) {
                // Check if we already have this registration
                if (!member.registrations.find(r => r.id == registration.id)) {
                    const g = groups.find(g => g.id == registration.groupId);
                    if (!g) {
                        throw new Error('Group not found');
                    }
                    if (g.deletedAt === null) {
                        member.registrations.push(registration.setRelation(Registration.group, g));
                    }
                }
            }

            // Check if we have a user
            const user = User.fromRow(row[User.table]);
            if (user) {
                // Check if we already have this registration
                if (!member.users.find(r => r.id == user.id)) {
                    member.users.push(user);
                }
            }
        }

        return members;
    }

    /**
     * Fetch all members with their corresponding (valid) registrations and payment
     */
    static async getFamilyWithRegistrations(id: string): Promise<MemberWithRegistrations[]> {
        let query = `SELECT l2.membersId as id from _members_users l1\n`;
        query += `JOIN _members_users l2 on l2.usersId = l1.usersId \n`;
        query += `where l1.membersId = ? group by l2.membersId`;

        const [results] = await Database.select(query, [id]);
        const ids: string[] = [];
        for (const row of results) {
            ids.push(row['l2']['id'] as string);
        }

        if (!ids.includes(id)) {
            // Member has no users
            ids.push(id);
        }

        return await this.getBlobByIds(...ids);
    }

    /**
     * Fetch all members with their corresponding (valid) registrations or waiting lists and payments
     */
    static async getMemberIdsForUser(user: User): Promise<string[]> {
        const query = SQL
            .select('id')
            .from(Member.table)
            .join(
                SQL
                    .leftJoin('_members_users')
                    .where(
                        SQL.column('_members_users', 'membersId'),
                        SQL.column(Member.table, 'id'),
                    ),
            ).where(
                SQL.column('_members_users', 'usersId'),
                user.id,
            );

        const data = await query.fetch();
        return data.map(r => r.members.id as string);
    }

    /**
     * Fetch all members with their corresponding (valid) registrations or waiting lists and payments
     */
    static async getMembersWithRegistrationForUser(user: User): Promise<MemberWithRegistrations[]> {
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

        if (this.details.uitpasNumber) {
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
