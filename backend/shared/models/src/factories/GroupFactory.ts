import { Factory } from '@simonbackx/simple-database';
import { GroupPrice, GroupSettings, OldGroupPrice, OldGroupPrices, ReduceablePrice } from '@stamhoofd/structures';

import { Group } from '../models/Group';
import { Organization } from '../models/Organization';
import { OrganizationFactory } from './OrganizationFactory';

class Options {
    organization?: Organization;
    price?: number;
    reducedPrice?: number;
    stock?: number;

    delayDate?: Date;
    delayPrice?: number;
    delayReducedPrice?: number;
    skipCategory?: boolean;
    maxMembers?: number | null;
}

export class GroupFactory extends Factory<Options, Group> {
    async create(): Promise<Group> {
        const organization = this.options.organization ?? await new OrganizationFactory({}).create();

        const group = new Group();
        group.organizationId = organization.id;
        group.periodId = organization.periodId;
        group.settings = GroupSettings.create({
            name: 'Group name',
            startDate: new Date(new Date().getTime() - 10 * 1000),
            endDate: new Date(new Date().getTime() + 10 * 1000),
            registrationStartDate: new Date(new Date().getTime() - 10 * 1000),
            registrationEndDate: new Date(new Date().getTime() + 10 * 1000),
            oldPrices: [
                OldGroupPrices.create({
                    prices: [OldGroupPrice.create({
                        price: this.options.price ?? 400,
                        reducedPrice: this.options.reducedPrice ?? null,
                    })],
                }),
            ],
            prices: [
                GroupPrice.create({
                    price: ReduceablePrice.create({
                        price: this.options.price ?? 400,
                        reducedPrice: this.options.reducedPrice ?? null,
                    }),
                    stock: this.options.stock ?? null,
                }),
            ],
            maxMembers: this.options.maxMembers === undefined ? null : this.options.maxMembers,
        });

        if (this.options.delayPrice !== undefined) {
            group.settings.oldPrices.push(OldGroupPrices.create({
                startDate: this.options.delayDate ?? new Date(),
                prices: [OldGroupPrice.create({
                    price: this.options.delayPrice,
                    reducedPrice: this.options.delayReducedPrice ?? null,
                })],
            }));
        }

        await group.save();

        if (!this.options.skipCategory) {
            organization.meta.rootCategory!.groupIds.push(group.id);
            await organization.save();
        }

        return group;
    }
}
