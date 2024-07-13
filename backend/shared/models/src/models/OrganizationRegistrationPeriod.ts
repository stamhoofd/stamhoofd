import { column, Model } from '@simonbackx/simple-database';
import { Group as GroupStruct, OrganizationRegistrationPeriodSettings, OrganizationRegistrationPeriod as OrganizationRegistrationPeriodStruct } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";
import { Group, RegistrationPeriod } from '.';
import { Formatter } from '@stamhoofd/utility';

export class OrganizationRegistrationPeriod extends Model {
    static table = "organization_registration_periods";

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string", nullable: true })
    organizationId: string | null = null;

    @column({ type: "string" })
    periodId: string

    @column({ type: "json", decoder: OrganizationRegistrationPeriodSettings })
    settings = OrganizationRegistrationPeriodSettings.create({})

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

    getStructure(this: OrganizationRegistrationPeriod, period: RegistrationPeriod, groups: Group[]) {
        return OrganizationRegistrationPeriodStruct.create({
            ...this,
            period: period.getStructure(),
            groups: groups.map(g => g.getStructure()).sort(GroupStruct.defaultSort)
        })
    }

    getPrivateStructure(this: OrganizationRegistrationPeriod, period: RegistrationPeriod, groups: Group[]) {
        return OrganizationRegistrationPeriodStruct.create({
            ...this,
            period: period.getStructure(),
            groups: groups.map(g => g.getPrivateStructure()).sort(GroupStruct.defaultSort)
        })
    }

    async cleanCategories(groups: {id: string}[]) {
        const reachable = new Map<string, boolean>()
        const queue = [this.settings.rootCategoryId]
        reachable.set(this.settings.rootCategoryId, true)
        let shouldSave = false;

        const usedGroupIds = new Set<string>()

        while (queue.length > 0) {
            const id = queue.shift()
            if (!id) {
                break
            }

            const category = this.settings.categories.find(c => c.id === id)
            if (!category) {
                continue
            }

            for (const i of category.categoryIds) {
                if (!reachable.get(i)) {
                    reachable.set(i, true)
                    queue.push(i)
                }
            }

            // Remove groupIds that no longer exist or are in a different category already
            let filtered = category.groupIds.filter(id => !!groups.find(g => g.id === id) && !usedGroupIds.has(id))

            // Remove duplicate groups
            filtered = Formatter.uniqueArray(filtered)

            if (filtered.length !== category.groupIds.length) {
                shouldSave = true;
                console.log("Deleted "+ (category.groupIds.length - filtered.length) +" group ids from category " + category.id + ", in organization period "+this.id)
                category.groupIds = filtered
            }

            for (const groupId of category.groupIds) {
                usedGroupIds.add(groupId)
            }
        }

        const reachableCategoryIds = [...reachable.keys()]

        // Delete all categories that are not reachable anymore
        const beforeCount = this.settings.categories.length;
        this.settings.categories = this.settings.categories.filter(c => reachableCategoryIds.includes(c.id))

        if (this.settings.categories.length !== beforeCount) {
            console.log("Deleted "+ (beforeCount - this.settings.categories.length) +" categories from organizaton period "+this.id)
            await this.save()
        } else {
            if (shouldSave) {
                await this.save()
            }
        }
    }
}
