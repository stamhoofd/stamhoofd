import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { Group as GroupStruct, OrganizationRegistrationPeriodSettings, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct, SetupSteps } from '@stamhoofd/structures';
import { Formatter } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { Group } from './Group.js';
import { RegistrationPeriod } from './RegistrationPeriod.js';
export class OrganizationRegistrationPeriod extends QueryableModel {
    static table = 'organization_registration_periods';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    organizationId: string;

    @column({ type: 'string' })
    periodId: string;

    @column({ type: 'json', decoder: OrganizationRegistrationPeriodSettings })
    settings = OrganizationRegistrationPeriodSettings.create({});

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

    @column({ type: 'json', decoder: SetupSteps })
    setupSteps = SetupSteps.create({});

    getStructure(this: OrganizationRegistrationPeriod, period: RegistrationPeriod, groups: Group[]) {
        return OrganizationRegistrationPeriodStruct.create({
            ...this,
            period: period.getStructure(),
            groups: groups.map(g => g.getStructure()).sort(GroupStruct.defaultSort),
        });
    }

    getPrivateStructure(this: OrganizationRegistrationPeriod, period: RegistrationPeriod, groups: Group[]) {
        return OrganizationRegistrationPeriodStruct.create({
            ...this,
            period: period.getStructure(),
            groups: groups.map(g => g.getPrivateStructure()).sort(GroupStruct.defaultSort),
        });
    }

    async cleanCategories(groups: { id: string }[], options?: { disableSave?: boolean }) {
        const reachable = new Map<string, boolean>();
        const queue = [this.settings.rootCategoryId];
        reachable.set(this.settings.rootCategoryId, true);
        let shouldSave = false;

        const usedGroupIds = new Set<string>();

        while (queue.length > 0) {
            const id = queue.shift();
            if (!id) {
                break;
            }

            const category = this.settings.categories.find(c => c.id === id);
            if (!category) {
                continue;
            }

            // Filter own categoryIds on existing categories
            const before = category.categoryIds.length;
            category.categoryIds = Formatter.uniqueArray(category.categoryIds.filter(childId => !!this.settings.categories.find(c => c.id === childId)));

            if (before !== category.categoryIds.length) {
                shouldSave = true;
                console.log('Deleted ' + (before - category.categoryIds.length) + ' category ids from category ' + category.id + ', in organization period ' + this.id);
            }

            for (const i of category.categoryIds) {
                if (!reachable.get(i)) {
                    reachable.set(i, true);
                    queue.push(i);
                }
            }

            // Remove groupIds that no longer exist or are in a different category already
            let filtered = category.groupIds.filter(id => !!groups.find(g => g.id === id) && !usedGroupIds.has(id));

            // Remove duplicate groups
            filtered = Formatter.uniqueArray(filtered);

            if (filtered.length !== category.groupIds.length) {
                shouldSave = true;
                console.log('Deleted ' + (category.groupIds.length - filtered.length) + ' group ids from category ' + category.id + ', in organization period ' + this.id);
                category.groupIds = filtered;
            }

            for (const groupId of category.groupIds) {
                usedGroupIds.add(groupId);
            }
        }

        const reachableCategoryIds = [...reachable.keys()];

        // Delete all categories that are not reachable anymore
        const beforeCount = this.settings.categories.length;
        this.settings.categories = this.settings.categories.filter(c => reachableCategoryIds.includes(c.id));

        if (!options?.disableSave) {
            if (this.settings.categories.length !== beforeCount) {
                console.log('Deleted ' + (beforeCount - this.settings.categories.length) + ' categories from organizaton period ' + this.id);
                await this.save();
            }
            else {
                if (shouldSave) {
                    await this.save();
                }
            }
        }
    }
}
