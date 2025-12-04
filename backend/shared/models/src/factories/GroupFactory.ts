import { Factory } from '@simonbackx/simple-database';
import { BundleDiscount, BundleDiscountGroupPriceSettings, GroupPrice, GroupPriceDiscount, GroupSettings, GroupType, ReduceablePrice, TranslatedString } from '@stamhoofd/structures';

import { SimpleError } from '@simonbackx/simple-errors';
import { RegistrationPeriod } from '../models/index.js';
import { Group } from '../models/Group.js';
import { Organization } from '../models/Organization.js';
import { OrganizationFactory } from './OrganizationFactory.js';

class Options {
    organization?: Organization;
    price?: number;
    reducedPrice?: number;
    stock?: number;
    type?: GroupType;
    maxMembers?: number | null;
    period?: RegistrationPeriod;
    waitingListId?: string;

    /**
     * Enable a given bundle discount on the group(price).
     */
    bundleDiscount?: BundleDiscount;
    bundleDiscounts?: BundleDiscount[] | Map<BundleDiscount, GroupPriceDiscount[] | null>;
}

export class GroupFactory extends Factory<Options, Group> {
    async create(): Promise<Group> {
        const organization = this.options.organization ?? await new OrganizationFactory({}).create();

        const group = new Group();
        group.organizationId = organization.id;

        if (this.options.period) {
            if (STAMHOOFD.userMode === 'organization' && this.options.period.organizationId !== group.organizationId) {
                throw new SimpleError({
                    code: 'invalid_period',
                    message: 'Period has different organization id',
                    statusCode: 400,
                });
            }
            group.periodId = this.options.period.id;
        }
        else {
            group.periodId = organization.periodId;
        }

        group.waitingListId = this.options.waitingListId ?? null;

        group.settings = GroupSettings.create({
            name: new TranslatedString('Group name'),
            startDate: new Date(new Date().getTime() - 10 * 1000),
            endDate: new Date(new Date().getTime() + 10 * 1000),
            registrationStartDate: new Date(new Date().getTime() - 10 * 1000),
            registrationEndDate: new Date(new Date().getTime() + 10 * 1000),
            prices: [
                GroupPrice.create({
                    price: ReduceablePrice.create({
                        price: this.options.price ?? 4_0000,
                        reducedPrice: this.options.reducedPrice ?? null,
                    }),
                    stock: this.options.stock ?? null,
                }),
            ],
            maxMembers: this.options.maxMembers === undefined ? null : this.options.maxMembers,
        });

        if (this.options.bundleDiscount) {
            group.settings.prices[0].bundleDiscounts.set(this.options.bundleDiscount.id, BundleDiscountGroupPriceSettings.create({
                name: this.options.bundleDiscount.name,
            }));
        }

        if (this.options.bundleDiscounts) {
            let map: Map<BundleDiscount, GroupPriceDiscount[] | null>;
            if (Array.isArray(this.options.bundleDiscounts)) {
                map = new Map<BundleDiscount, GroupPriceDiscount[] | null>();
                for (const discount of this.options.bundleDiscounts) {
                    map.set(discount, null);
                }
            }
            else {
                map = this.options.bundleDiscounts;
            }

            for (const [discount, customDiscounts] of map.entries()) {
                group.settings.prices[0].bundleDiscounts.set(discount.id, BundleDiscountGroupPriceSettings.create({
                    name: discount.name,
                    customDiscounts,
                }));
            }
        }

        if (this.options.type) {
            group.type = this.options.type;
        }

        await group.save();
        return group;
    }
}
