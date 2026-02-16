import { column, Database, ManyToOneRelation } from '@simonbackx/simple-database';
import { GroupCategory, GroupPrivateSettings, GroupSettings, GroupStatus, Group as GroupStruct, GroupType, StockReservation } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

import { ArrayDecoder } from '@simonbackx/simple-encoding';
import { QueueHandler } from '@stamhoofd/queues';
import { ModelCache, QueryableModel } from '@stamhoofd/sql';
import { Member, OrganizationRegistrationPeriod, Payment, Registration, User } from './index.js';

if (Member === undefined) {
    throw new Error('Import Member is undefined');
}
if (User === undefined) {
    throw new Error('Import User is undefined');
}
if (Payment === undefined) {
    throw new Error('Import Payment is undefined');
}
if (Registration === undefined) {
    throw new Error('Import Registration is undefined');
}

export class Group extends QueryableModel {
    static table = 'groups';
    // static cache = new ModelCache<Group>();

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    type = GroupType.Membership;

    @column({ type: 'json', decoder: GroupSettings })
    settings: GroupSettings;

    @column({
        type: 'json', decoder: GroupPrivateSettings,
    })
    privateSettings = GroupPrivateSettings.create({});

    @column({ type: 'string' })
    organizationId: string;

    @column({ type: 'string', nullable: true })
    waitingListId: string | null = null;

    @column({ type: 'string' })
    periodId: string;

    @column({ type: 'string', nullable: true })
    defaultAgeGroupId: string | null = null;

    /**
     * Every time a new registration period starts, this number increases. This is used to mark all older registrations as 'out of date' automatically
     */
    @column({ type: 'integer' })
    cycle = 0;

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

    @column({
        type: 'datetime',
        nullable: true,
    })
    deletedAt: Date | null = null;

    @column({ type: 'string' })
    status = GroupStatus.Open;

    /**
     * Editing this field is only allowed when running inside the QueueHandler
     */
    @column({ type: 'json', decoder: new ArrayDecoder(StockReservation) })
    stockReservations: StockReservation[] = [];

    static async getAll(organizationId: string, periodId: string | null, active = true, types: GroupType[] = [GroupType.Membership]): Promise<Group[]> {
        const query = Group.select()
            .where('organizationId', organizationId);

        if (active) {
            query.andWhere('deletedAt', null);
        }

        if (periodId) {
            query.andWhere('periodId', periodId);
        }

        query.andWhere('type', types);

        return await query.fetch();
    }

    /**
     * Returns all parent and grandparents of this group
     */
    getParentCategories(all: GroupCategory[], recursive = true): GroupCategory[] {
        const map = new Map<string, GroupCategory>();

        const parents = all.filter(g => g.groupIds.includes(this.id));
        for (const parent of parents) {
            map.set(parent.id, parent);

            if (recursive) {
                const hisParents = parent.getParentCategories(all);
                for (const pp of hisParents) {
                    map.set(pp.id, pp);
                }
            }
        }

        return [...map.values()];
    }

    /**
     * @deprecated
     */
    getStructure() {
        return GroupStruct.create({ ...this, privateSettings: null });
    }

    /**
     * @deprecated
     */
    getPrivateStructure() {
        return GroupStruct.create(this);
    }

    private static async getCount(where: string, params: any[]) {
        const query = `select count(*) as c from \`${Registration.table}\` where ${where}`;

        const [results] = await Database.select(query, params);
        const count = results[0]['']['c'];
        if (Number.isInteger(count)) {
            return count as number;
        }
        return null;
    }

    async updateOccupancy() {
        this.settings.registeredMembers = await Group.getCount(
            'groupId = ? and registeredAt is not null AND deactivatedAt is null',
            [this.id],
        );

        this.settings.reservedMembers = await Group.getCount(
            'groupId = ? and registeredAt is null AND (canRegister = 1 OR reservedUntil >= ?)',
            [this.id, new Date()],
        );
    }

    static async deleteUnreachable(organizationId: string, period: OrganizationRegistrationPeriod, allGroups: Group[]) {
        const reachable = new Map<string, boolean>();

        const visited = new Map<string, boolean>();
        const queue = [period.settings.rootCategoryId];
        visited.set(period.settings.rootCategoryId, true);

        while (queue.length > 0) {
            const id = queue.shift();
            if (!id) {
                break;
            }

            const category = period.settings.categories.find(c => c.id === id);
            if (!category) {
                continue;
            }

            for (const i of category.categoryIds) {
                if (!visited.get(i)) {
                    queue.push(i);
                    visited.set(i, true);
                }
            }

            for (const g of category.groupIds) {
                reachable.set(g, true);
            }
        }

        for (const group of allGroups) {
            if (group.periodId !== period.periodId) {
                continue;
            }

            if (group.type !== GroupType.Membership) {
                continue;
            }

            if (!reachable.get(group.id) && group.deletedAt === null) {
                console.log('Deleting unreachable group ' + group.id + ' from organization ' + organizationId + ' org period ' + period.id);
                group.deletedAt = new Date();
                await group.save();
            }
        }
    }

    static async applyStockReservations(groupId: string, addStockReservations: StockReservation[], free = false) {
        await QueueHandler.schedule('group-stock-update-' + groupId, async () => {
            const updatedGroup = await Group.getByID(groupId);
            if (!updatedGroup) {
                throw new Error('Expected group');
            }

            if (!free) {
                updatedGroup.stockReservations = StockReservation.added(updatedGroup.stockReservations, addStockReservations);
            }
            else {
                updatedGroup.stockReservations = StockReservation.removed(updatedGroup.stockReservations, addStockReservations);
            }
            await updatedGroup.save();
        });
    }

    static async freeStockReservations(groupId: string, reservations: StockReservation[]) {
        return await this.applyStockReservations(groupId, reservations, true);
    }
}

Registration.group = new ManyToOneRelation(Group, 'group');
Registration.group.foreignKey = 'groupId';
