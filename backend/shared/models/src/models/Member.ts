import { column, Database, ManyToManyRelation, ManyToOneRelation, Model, OneToManyRelation } from '@simonbackx/simple-database';
import { EncryptedMemberWithRegistrations, Member as MemberStruct, MemberDetails, RegistrationWithMember as RegistrationWithMemberStruct, User as UserStruct } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";
import { Payment, Registration, User } from './';
export type MemberWithRegistrations = Member & { registrations: Registration[]; users: User[] }

// Defined here to prevent cycles
export type RegistrationWithMember = Registration & { member: Member }

export class Member extends Model {
    static table = "members"

    // Columns
    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    organizationId: string;

    @column({
        type: "string", 
        beforeSave: function() {
            return this.details?.firstName ?? ''
        },
        skipUpdate: true
    })
    firstName: string

    @column({ type: "string", 
        beforeSave: function() {
            return this.details?.lastName ?? ''
        },
        skipUpdate: true })
    lastName: string

    @column({ 
        type: "string", 
        nullable: true, 
        beforeSave: function() {
            return this.details?.birthDay ? Formatter.dateIso(this.details.birthDay) : null
        },
        skipUpdate: true 
    })
    birthDay: string | null

    @column({ type: "json", decoder: MemberDetails })
    details: MemberDetails

    @column({
        type: "datetime", beforeSave(old?: any) {
            if (old !== undefined) {
                return old;
            }
            const date = new Date()
            date.setMilliseconds(0)
            return date
        }
    })
    createdAt: Date

    @column({
        type: "datetime", beforeSave() {
            const date = new Date()
            date.setMilliseconds(0)
            return date
        },
        skipUpdate: true
    })
    updatedAt: Date

    static registrations = new OneToManyRelation(Member, Registration, "registrations", "memberId")

    // Note: all relations should point to their parents, not the other way around to avoid reference cycles
    static users = new ManyToManyRelation(Member, User, "users");

    /**
     * Fetch all members with their corresponding (valid) registration
     */
    static async getWithRegistrations(id: string): Promise<MemberWithRegistrations | null> {
        return (await this.getAllWithRegistrations(id))[0] ?? null
    }

    /**
     * Fetch all registrations with members with their corresponding (valid) registrations
     */
    static async getRegistrationWithMembersByIDs(ids: string[]): Promise<RegistrationWithMember[]> {
        if (ids.length === 0) {
            return []
        }
        let query = `SELECT ${Member.getDefaultSelect()}, ${Registration.getDefaultSelect()} from \`${Member.table}\`\n`;
        
        query += `JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\`\n`

        // We do an extra join because we also need to get the other registrations of each member (only one regitration has to match the query)
        query += `where \`${Registration.table}\`.\`${Registration.primary.name}\` IN (?)`

        const [results] = await Database.select(query, [ids])
        const registrations: RegistrationWithMember[] = []

         // In the future we might add a 'reverse' method on manytoone relation, instead of defining the new relation. But then we need to store 2 model types in the many to one relation.
        const registrationMemberRelation = new ManyToOneRelation(Member, "member")
        registrationMemberRelation.foreignKey = Member.registrations.foreignKey

        for (const row of results) {
            const registration = Registration.fromRow(row[Registration.table])
            if (!registration) {
                throw new Error("Expected registration in every row")
            }

            const foundMember = Member.fromRow(row[Member.table])
            if (!foundMember) {
                throw new Error("Expected member in every row")
            }
            
            const _f = registration.setRelation(registrationMemberRelation, foundMember)           
            registrations.push(_f)
        }

        return registrations
    }

     /**
     * Fetch all registrations with members with their corresponding (valid) registrations and payment
     */
    static async getRegistrationWithMembersForPayment(paymentId: string): Promise<RegistrationWithMember[]> {
        const { BalanceItem, BalanceItemPayment} = await import('./');

        let query = `SELECT ${Member.getDefaultSelect()}, ${Registration.getDefaultSelect()} from \`${Member.table}\`\n`;
        
        query += `JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\`\n`
        
        query += `LEFT JOIN \`${BalanceItem.table}\` ON \`${BalanceItem.table}\`.\`registrationId\` = \`${Registration.table}\`.\`${Registration.primary.name}\`\n`
        query += `LEFT JOIN \`${BalanceItemPayment.table}\` ON \`${BalanceItemPayment.table}\`.\`${BalanceItemPayment.balanceItem.foreignKey}\` = \`${BalanceItem.table}\`.\`${BalanceItem.primary.name}\`\n`
        query += `JOIN \`${Payment.table}\` ON \`${Payment.table}\`.\`${Payment.primary.name}\` = \`${BalanceItemPayment.table}\`.\`${BalanceItemPayment.payment.foreignKey}\`\n`

        // We do an extra join because we also need to get the other registrations of each member (only one regitration has to match the query)
        query += `WHERE \`${Payment.table}\`.\`${Payment.primary.name}\` = ?\n`
        query += `GROUP BY \`${Registration.table}\`.\`${Registration.primary.name}\`, \`${Member.table}\`.\`${Member.primary.name}\``

        const [results] = await Database.select(query, [paymentId])
        const registrations: RegistrationWithMember[] = []

         // In the future we might add a 'reverse' method on manytoone relation, instead of defining the new relation. But then we need to store 2 model types in the many to one relation.
        const registrationMemberRelation = new ManyToOneRelation(Member, "member")
        registrationMemberRelation.foreignKey = Member.registrations.foreignKey

        for (const row of results) {
            const registration = Registration.fromRow(row[Registration.table])
            if (!registration) {
                throw new Error("Expected registration in every row")
            }

            const foundMember = Member.fromRow(row[Member.table])
            if (!foundMember) {
                throw new Error("Expected member in every row")
            }
            
            const _f = registration.setRelation(registrationMemberRelation, foundMember)           
            registrations.push(_f)
        }

        return registrations
    }

     /**
     * Fetch all members with their corresponding (valid) registrations, users
     */
    static async getAllWithRegistrations(...ids: string[]): Promise<MemberWithRegistrations[]> {
        if (ids.length == 0) {
            return []
        }
        let query = `SELECT ${Member.getDefaultSelect()}, ${Registration.getDefaultSelect()}, ${User.getDefaultSelect()}  from \`${Member.table}\`\n`;
        
        //query += `JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\` AND (\`${Registration.table}\`.\`registeredAt\` is not null OR \`${Registration.table}\`.\`waitingList\` = 1)\n`
        query += `LEFT JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\`\n`

        query += Member.users.joinQuery(Member.table, User.table)+"\n"

        // We do an extra join because we also need to get the other registrations of each member (only one regitration has to match the query)
        query += `where \`${Member.table}\`.\`${Member.primary.name}\` IN (?)`

        const [results] = await Database.select(query, [ids])
        const members: MemberWithRegistrations[] = []

        for (const row of results) {
            const foundMember = Member.fromRow(row[Member.table])
            if (!foundMember) {
                throw new Error("Expected member in every row")
            }
            const _f = foundMember.setManyRelation(Member.registrations as unknown as OneToManyRelation<"registrations", Member, Registration>, []).setManyRelation(Member.users, [])
            // Seach if we already got this member?
            const existingMember = members.find(m => m.id == _f.id)

            const member: MemberWithRegistrations = (existingMember ?? _f)
            if (!existingMember) {
                members.push(member)
            }

             // Check if we have a registration with a payment
            const registration = Registration.fromRow(row[Registration.table])
            if (registration) {
                // Check if we already have this registration
                if (!member.registrations.find(r => r.id == registration.id)) {
                    member.registrations.push(registration)
                }
            }

            // Check if we have a user
            const user = User.fromRow(row[User.table])
            if (user) {
                // Check if we already have this registration
                if (!member.users.find(r => r.id == user.id)) {
                    member.users.push(user)
                }
            }
        }

        return members

    }

    /**
     * Fetch all members with their corresponding (valid) registrations and payment
     */
    static async getFamilyWithRegistrations(id: string): Promise<MemberWithRegistrations[]> {
        let query = `SELECT l2.membersId as id from _members_users l1\n`;
        query += `JOIN _members_users l2 on l2.usersId = l1.usersId \n`
        query += `where l1.membersId = ? group by l2.membersId`

        const [results] = await Database.select(query, [id])
        const ids: string[] = []
        for (const row of results) {
            ids.push(row["l2"]["id"])
        }

        if (!ids.includes(id)) {
            // Member has no users
            ids.push(id)
        }
        
        return await this.getAllWithRegistrations(...ids)
    }

     /**
     * Fetch all members with their corresponding (valid) registrations or waiting lists and payments
     */
    static async getMembersWithRegistrationForUser(user: User): Promise<MemberWithRegistrations[]> {
        let query = `SELECT ${Member.getDefaultSelect()}, ${Registration.getDefaultSelect()} from \`${Member.users.linkTable}\`\n`;
        query += `JOIN \`${Member.table}\` ON \`${Member.table}\`.\`${Member.primary.name}\` = \`${Member.users.linkTable}\`.\`${Member.users.linkKeyA}\`\n`
        
        //query += `LEFT JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\` AND (\`${Registration.table}\`.\`registeredAt\` is not null OR \`${Registration.table}\`.waitingList = 1)\n`
        query += `LEFT JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\`\n`

        query += `where \`${Member.users.linkTable}\`.\`${Member.users.linkKeyB}\` = ?`

        const [results] = await Database.select(query, [user.id])
        const members: MemberWithRegistrations[] = []

        for (const row of results) {
            const foundMember = Member.fromRow(row[Member.table])
            if (!foundMember) {
                throw new Error("Expected member in every row")
            }
            const _f = foundMember.setManyRelation(Member.registrations as unknown as OneToManyRelation<"registrations", Member, Registration>, []).setManyRelation(Member.users, [
                user // for now only assign this... Todo: expand with query
            ])

            // Seach if we already got this member?
            const existingMember = members.find(m => m.id == _f.id)

            const member: MemberWithRegistrations = (existingMember ?? _f)
            if (!existingMember) {
                members.push(member)
            }

            // Check if we have a registration with a payment
            const registration = Registration.fromRow(row[Registration.table])
            if (registration) {
                member.registrations.push(registration)
            }
        }

        return members

    }

    getStructureWithRegistrations(this: MemberWithRegistrations, forOrganization: null | boolean = null) {
        return EncryptedMemberWithRegistrations.create({
            ...this,
            registrations: this.registrations.map(r => r.getStructure()),
            details: this.details,
            users: this.users.map(u => UserStruct.create({...u, hasAccount: u.hasAccount()})),
        })
    }

    static getRegistrationWithMemberStructure(registration: RegistrationWithMember & {group: import('./Group').Group}): RegistrationWithMemberStruct {
        return RegistrationWithMemberStruct.create({
            ...registration,
            group: registration.group.getStructure(),
            cycle: registration.cycle,
            member: MemberStruct.create(registration.member),
        })
    }

    hasReadAccess(this: MemberWithRegistrations, user: User, groups: import('./Group').Group[], needAll = false) {
        if (!user.permissions) {
            return false
        }
        if (user.permissions.hasReadAccess()) {
            return true;
        }

        for (const registration of this.registrations) {
            if (registration.hasReadAccess(user, groups)) {
                if (!needAll) {
                    return true;
                }
            } else {
                if (needAll) {
                    return false
                }
            }
        }

        if (needAll) {
            return this.registrations.length > 0;
        }
        return false;
    }

    async hasWriteAccess(this: MemberWithRegistrations, user: User, groups: import('./Group').Group[], needAll = false, checkFamily = false) {
        if (!user.permissions) {
            return false
        }

        if (user.permissions.hasWriteAccess()) {
            return true;
        }

        for (const registration of this.registrations) {
            if (registration.hasWriteAccess(user, groups)) {
                if (!needAll) {
                    return true;
                }
            } else {
                if (needAll) {
                    return false
                }
            }
        }

        if (needAll) {
            return true;
        }         
        
        // Check family acccess
        if (checkFamily) {
            const members = (await Member.getFamilyWithRegistrations(this.id))
            for (const member of members) {
                if (await member.hasWriteAccess(user, groups, false, false)) {
                    return true
                }
            }
        }
        
        return false
    }
}