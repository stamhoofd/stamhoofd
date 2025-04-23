import { Factory } from '@simonbackx/simple-database';
import { GroupPrice, GroupSettings, GroupType, ReduceablePrice, TranslatedString } from '@stamhoofd/structures';

import { RegistrationPeriod } from '../models';
import { Group } from '../models/Group';
import { Organization } from '../models/Organization';
import { OrganizationFactory } from './OrganizationFactory';

class Options {
    organization?: Organization;
    price?: number;
    reducedPrice?: number;
    stock?: number;
    type?: GroupType;
    skipCategory?: boolean;
    maxMembers?: number | null;
    period?: RegistrationPeriod;
}

export class GroupFactory extends Factory<Options, Group> {
    async create(): Promise<Group> {
        const organization = this.options.organization ?? await new OrganizationFactory({}).create();

        const group = new Group();
        group.organizationId = organization.id;

        if (this.options.period) {
            group.periodId = this.options.period.id;
        }
        else {
            group.periodId = organization.periodId;
        }

        group.settings = GroupSettings.create({
            name: new TranslatedString('Group name'),
            startDate: new Date(new Date().getTime() - 10 * 1000),
            endDate: new Date(new Date().getTime() + 10 * 1000),
            registrationStartDate: new Date(new Date().getTime() - 10 * 1000),
            registrationEndDate: new Date(new Date().getTime() + 10 * 1000),
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

        if (this.options.type) {
            group.type = this.options.type;
        }

        await group.save();

        if (!this.options.skipCategory) {
            organization.meta.rootCategory!.groupIds.push(group.id);
            await organization.save();
        }

        return group;
    }
}
