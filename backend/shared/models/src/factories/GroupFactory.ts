import { Factory } from "@simonbackx/simple-database";
import { GroupCategory, GroupPrice, GroupPrices,GroupSettings } from "@stamhoofd/structures";

import { Group } from "../models/Group";
import { Organization } from "../models/Organization";
import { OrganizationFactory } from './OrganizationFactory';

class Options {
    organization?: Organization;
    price?: number;
    reducedPrice?: number

    delayDate?: Date
    delayPrice?: number
    delayReducedPrice?: number
    skipCategory?: boolean
}

export class GroupFactory extends Factory<Options, Group> {
    async create(): Promise<Group> {
        const organization = this.options.organization ?? await new OrganizationFactory({}).create()
        
        const group = new Group()
        group.organizationId = organization.id
        group.settings = GroupSettings.create({
            name: "Group name",
            startDate: new Date(new Date().getTime() - 10 * 1000),
            endDate: new Date(new Date().getTime() + 10 * 1000),
            registrationStartDate: new Date(new Date().getTime() - 10 * 1000),
            registrationEndDate: new Date(new Date().getTime() + 10 * 1000),
            prices: [
                GroupPrices.create({
                    prices: [GroupPrice.create({
                        price: this.options.price ?? 400,
                        reducedPrice: this.options.reducedPrice ?? null
                    })],
                })
            ],
        })

        if (this.options.delayPrice !== undefined) {
            group.settings.prices.push(GroupPrices.create({
                startDate: this.options.delayDate ?? new Date(),
                prices: [GroupPrice.create({
                    price: this.options.delayPrice,
                    reducedPrice: this.options.delayReducedPrice ?? null
                })],
            }))
        }

        await group.save()

        if (!this.options.skipCategory) {
            organization.meta.rootCategory!.groupIds.push(group.id)
            await organization.save()
        }
        
        return group;
    }
}
