import { column, Database, Model, OneToManyRelation } from '@simonbackx/simple-database';
import { CycleInformation, Group as GroupStruct, GroupCategory, GroupPrivateSettings, GroupSettings, GroupStatus, OrganizationMetaData, PermissionLevel, Permissions } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

import { Member, MemberWithRegistrations, Payment, Registration, User, UserWithOrganization } from './';

if (Member === undefined) {
    throw new Error("Import Member is undefined")
}
if (User === undefined) {
    throw new Error("Import User is undefined")
}
if (Payment === undefined) {
    throw new Error("Import Payment is undefined")
}
if (Registration === undefined) {
    throw new Error("Import Registration is undefined")
}
export class Group extends Model {
    static table = "groups";

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "json", decoder: GroupSettings })
    settings: GroupSettings;

    @column({ 
        type: "json", decoder: GroupPrivateSettings, beforeSave(value) {
            return value ?? GroupPrivateSettings.create({})
        } 
    })
    privateSettings: GroupPrivateSettings;

    @column({ type: "string" })
    organizationId: string;

    /**
     * Every time a new registration period starts, this number increases. This is used to mark all older registrations as 'out of date' automatically
     */
    @column({ type: "integer" })
    cycle = 0;

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

    @column({
        type: "datetime",
        nullable: true
    })
    deletedAt: Date | null = null

    /**
     * Every time a new registration period starts, this number increases. This is used to mark all older registrations as 'out of date' automatically
     */
    @column({ type: "string" })
    status = GroupStatus.Open;

    static async getAll(organizationId: string, active = true) {
        if (active) {
            return await Group.where({ organizationId, deletedAt: null, status: {sign: '!=', value: GroupStatus.Archived} })
        }
        return await Group.where({ organizationId })
    }

    /**
     * Returns all parent and grandparents of this group
     */
    getParentCategories(all: GroupCategory[], recursive = true): GroupCategory[] {
        const map = new Map<string, GroupCategory>()
        
        const parents = all.filter(g => g.groupIds.includes(this.id))
        for (const parent of parents) {
            map.set(parent.id, parent)

            if (recursive) {
                const hisParents = parent.getParentCategories(all)
                for (const pp of hisParents) {
                    map.set(pp.id, pp)
                }
            }
        }

        return [...map.values()]
    }

    hasAccess(user: UserWithOrganization, permissionLevel: PermissionLevel = PermissionLevel.Read) {
        if (!user.permissions || user.organizationId != this.organizationId) {
            return false
        }

        if (this.privateSettings.permissions.userHasAccess(user, permissionLevel)) {
            return true;
        }

        // Check parent categories
        const parentCategories = this.getParentCategories(user.organization.meta.categories)
        for (const category of parentCategories) {
            if (category.settings.permissions.groupPermissions.userHasAccess(user, permissionLevel)) {
                return true
            }
        }

        return false;
    }

    /**
     * Fetch all members with their corresponding (valid) registrations, users
     */
    async getMembersWithRegistration(waitingList = false, cycleOffset = 0): Promise<MemberWithRegistrations[]> {
        let query = `SELECT ${Member.getDefaultSelect()}, ${Registration.getDefaultSelect()}, ${User.getDefaultSelect()} from \`${Member.table}\`\n`;
        
        query += `JOIN \`${Registration.table}\` ON \`${Registration.table}\`.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\` AND (\`${Registration.table}\`.\`registeredAt\` is not null OR \`${Registration.table}\`.\`waitingList\` = 1)\n`

        if (waitingList) {
            query += `JOIN \`${Registration.table}\` as reg_filter ON reg_filter.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\` AND reg_filter.\`waitingList\` = 1\n`
        } else {
            query += `JOIN \`${Registration.table}\` as reg_filter ON reg_filter.\`${Member.registrations.foreignKey}\` = \`${Member.table}\`.\`${Member.primary.name}\` AND reg_filter.\`waitingList\` = 0 AND reg_filter.\`registeredAt\` is not null\n`
        }

        query += Member.users.joinQuery(Member.table, User.table)+"\n"

        // We do an extra join because we also need to get the other registrations of each member (only one regitration has to match the query)
        query += `where reg_filter.\`groupId\` = ? AND reg_filter.\`cycle\` = ?`

        const [results] = await Database.select(query, [this.id, this.cycle - cycleOffset])
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

    getStructure() {
        return GroupStruct.create(Object.assign({}, this, { privateSettings: null }))
    }

    getPrivateStructure(user?: UserWithOrganization) {
        const struct = GroupStruct.create(this)
        if (user && !this.hasAccess(user)) {
            struct.privateSettings = null
        }
        return struct
    }

    private static async getCount(where: string, params: any[]) {
        const query = `select count(*) as c from \`${Registration.table}\` where ${where}`
        
        const [results] = await Database.select(query, params)
        const count = results[0]['']['c'];
        if (Number.isInteger(count)) {
            return count
        }
        return null
    }

    async updateOccupancy() {
        this.settings.registeredMembers = await Group.getCount(
            "groupId = ? and cycle = ? and waitingList = 0 and registeredAt is not null",
            [this.id, this.cycle]
        )
        //const query = `select count(*) as c from \`${Registration.table}\` where groupId = ? and cycle = ? and (((registeredAt is not null or reservedUntil >= ?) and waitingList = 0) OR (waitingList = 1 AND canRegister = 1))`

        this.settings.reservedMembers = await Group.getCount(
            "groupId = ? and cycle = ? and ((waitingList = 0 and registeredAt is null AND reservedUntil >= ?) OR (waitingList = 1 and canRegister = 1))",
            [this.id, this.cycle, new Date()]
        )

        this.settings.waitingListSize = await Group.getCount(
            "groupId = ? and cycle = ? and waitingList = 1",
            [this.id, this.cycle, new Date()]
        )

        // Loop cycle 0 until current (excluding current)
        for (let cycle = 0; cycle < this.cycle; cycle++) {
            if (!this.settings.cycleSettings.has(cycle)) {
                this.settings.cycleSettings.set(cycle, CycleInformation.create({
                    registeredMembers: 0,
                    reservedMembers: 0,
                    waitingListSize: 0
                }))
            }
        }

        // Older cycles
        // todo: optimize this a bit
        for (const [cycle, info] of this.settings.cycleSettings) {

            info.registeredMembers = await Group.getCount(
                "groupId = ? and cycle = ? and waitingList = 0 and registeredAt is not null",
                [this.id, cycle]
            )

            info.reservedMembers = await Group.getCount(
                "groupId = ? and cycle = ? and ((waitingList = 0 and registeredAt is null AND reservedUntil >= ?) OR (waitingList = 1 and canRegister = 1))",
                [this.id, cycle, new Date()]
            )

            info.waitingListSize = await Group.getCount(
                "groupId = ? and cycle = ? and waitingList = 1",
                [this.id, cycle, new Date()]
            )
        }
    }

    static async deleteUnreachable(organizationId: string, organizationMetaData: OrganizationMetaData, allGroups: Group[]) {
        const reachable = new Map<string, boolean>()

        const visited = new Map<string, boolean>()
        const queue = [organizationMetaData.rootCategoryId]
        visited.set(organizationMetaData.rootCategoryId, true)

        while (queue.length > 0) {
            const id = queue.shift()
            if (!id) {
                break
            }

            const category = organizationMetaData.categories.find(c => c.id === id)
            if (!category) {
                continue
            }

            for (const i of category.categoryIds) {
                if (!visited.get(i)) {
                    queue.push(i)
                    visited.set(i, true)
                }
            }

            for (const g of category.groupIds) {
                reachable.set(g, true)
            }
        }

        for (const group of allGroups) {
            if (!reachable.get(group.id) && group.status !== GroupStatus.Archived) {
                console.log("Archiving unreachable group "+group.id+" from organization "+organizationId)
                group.status = GroupStatus.Archived
                await group.save()
            }
        }
    }

}